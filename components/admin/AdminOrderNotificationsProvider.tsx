"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdminNewPedidoModal } from "@/components/admin/AdminNewPedidoModal";
import type { CollaboratorJobRole } from "@/lib/admin-permissions";
import {
  type AdminWebOrderNotification,
  loadPersistedNotificationIds,
  persistNotificationIds,
  rowToWebOrderNotification,
} from "@/lib/admin-web-order-notifications";
import { isDocumentVisible, trimSet } from "@/lib/document-visibility";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Ctx = {
  notifications: AdminWebOrderNotification[];
  unreadCount: number;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  modalPedido: AdminWebOrderNotification | null;
  dismissModal: () => void;
  jobRole: CollaboratorJobRole | null;
};

const AdminOrderNotificationsContext = createContext<Ctx | null>(null);

export function useAdminOrderNotifications() {
  const ctx = useContext(AdminOrderNotificationsContext);
  if (!ctx) {
    throw new Error("useAdminOrderNotifications debe usarse dentro del provider");
  }
  return ctx;
}

const POLL_MS = 12_000;
const SEEN_IDS_CAP = 400;
const ORDER_SELECT =
  "id, status, customer_name, customer_email, total_cents, created_at, checkout_payment_method, wompi_reference";

export function AdminOrderNotificationsProvider({
  enabled,
  branchId,
  jobRole = null,
  children,
}: {
  enabled: boolean;
  branchId: string;
  jobRole?: CollaboratorJobRole | null;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<AdminWebOrderNotification[]>(
    [],
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalPedido, setModalPedido] =
    useState<AdminWebOrderNotification | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);
  const allowModalRef = useRef(false);

  const pushNotification = useCallback(
    (item: AdminWebOrderNotification, opts?: { fromLive?: boolean }) => {
      const isNew = !seenIdsRef.current.has(item.id);
      if (isNew) {
        seenIdsRef.current.add(item.id);
        trimSet(seenIdsRef.current, SEEN_IDS_CAP);
        persistNotificationIds(seenIdsRef.current);
      }

      setNotifications((prev) => {
        if (prev.some((n) => n.id === item.id)) {
          return prev.map((n) => (n.id === item.id ? { ...n, ...item } : n));
        }
        return [{ ...item, read: false }, ...prev].slice(0, 30);
      });

      if (
        opts?.fromLive &&
        allowModalRef.current &&
        isNew &&
        item.kind === "pedido"
      ) {
        setModalPedido({ ...item, read: false });
      }
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissModal = useCallback(() => {
    setModalPedido((cur) => {
      if (cur) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === cur.id ? { ...n, read: true } : n)),
        );
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    seenIdsRef.current = loadPersistedNotificationIds();
    const supabase = createSupabaseBrowserClient();

    let channel: RealtimeChannel | null = null;
    let pollTimer: number | undefined;
    let fallbackTimer: number | undefined;
    let pollInFlight = false;
    let cancelled = false;
    let realtimeOk = false;

    const stopChannel = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
      realtimeOk = false;
    };

    const stopPoll = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
      if (fallbackTimer != null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = undefined;
      }
    };

    const pollPending = async () => {
      if (cancelled || pollInFlight || !isDocumentVisible()) {
        return;
      }
      // Seguir haciendo poll aunque haya realtime: pedidos POS son críticos
      // en cocina/salón y el canal a veces no entrega INSERT locales.
      pollInFlight = true;
      try {
        const { data } = await supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("status", "pending")
          .eq("branch_id", branchId)
          .order("created_at", { ascending: false })
          .limit(8);
        if (cancelled) return;
        for (const row of data ?? []) {
          const item = rowToWebOrderNotification(row as Record<string, unknown>);
          if (item) pushNotification(item, { fromLive: bootstrappedRef.current });
        }
      } finally {
        pollInFlight = false;
      }
    };

    const startPoll = () => {
      if (cancelled || pollTimer != null) return;
      pollTimer = window.setInterval(() => {
        void pollPending();
      }, POLL_MS);
    };

    const startChannel = () => {
      if (cancelled || channel) return;
      channel = supabase
        .channel(`admin-orders:${branchId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `branch_id=eq.${branchId}`,
          },
          (payload) => {
            if (!isDocumentVisible()) return;
            const item = rowToWebOrderNotification(
              payload.new as Record<string, unknown>,
            );
            if (item) pushNotification(item, { fromLive: true });
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            realtimeOk = true;
            // Poll de respaldo igual (pedidos POS).
            startPoll();
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            realtimeOk = false;
            startPoll();
            void pollPending();
          }
        });

      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = undefined;
        if (!cancelled && !realtimeOk) {
          startPoll();
          void pollPending();
        }
      }, 2500);
    };

    const bootstrap = async () => {
      if (bootstrappedRef.current) return;
      const { data } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("status", "pending")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (cancelled) return;

      const items = (data ?? [])
        .map((row) => rowToWebOrderNotification(row as Record<string, unknown>))
        .filter((n): n is AdminWebOrderNotification => n != null)
        .map((n) => {
          seenIdsRef.current.add(n.id);
          return {
            ...n,
            read: true,
          };
        });
      trimSet(seenIdsRef.current, SEEN_IDS_CAP);
      persistNotificationIds(seenIdsRef.current);

      setNotifications(items);
      bootstrappedRef.current = true;
      allowModalRef.current = true;
    };

    const resume = () => {
      if (cancelled || !isDocumentVisible()) return;
      startChannel();
      startPoll();
    };

    const pause = () => {
      stopPoll();
      stopChannel();
    };

    const onVisibility = () => {
      if (isDocumentVisible()) resume();
      else pause();
    };

    void (async () => {
      await bootstrap();
      if (cancelled) return;
      if (isDocumentVisible()) resume();
    })();

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      pause();
    };
  }, [branchId, enabled, pushNotification]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      panelOpen,
      setPanelOpen,
      markRead,
      markAllRead,
      modalPedido,
      dismissModal,
      jobRole,
    }),
    [
      notifications,
      unreadCount,
      panelOpen,
      markRead,
      markAllRead,
      modalPedido,
      dismissModal,
      jobRole,
    ],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <AdminOrderNotificationsContext.Provider value={value}>
      {children}
      <AdminNewPedidoModal />
    </AdminOrderNotificationsContext.Provider>
  );
}
