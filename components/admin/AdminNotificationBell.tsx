"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAdminOrderNotifications } from "@/components/admin/AdminOrderNotificationsProvider";
import { formatCop } from "@/lib/money";
import {
  orderNotificationSubtitle,
  pedidoChannelLabel,
  webOrderPaymentLabel,
} from "@/lib/admin-web-order-notifications";
import { formatStoreDateTime } from "@/lib/store-datetime-format";
import { ventaNumeroReferencia } from "@/lib/ventas-sales";

function IconBell({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  );
}

export function AdminNotificationBell({ className }: { className?: string }) {
  const {
    notifications,
    unreadCount,
    panelOpen,
    setPanelOpen,
    markRead,
    markAllRead,
  } = useAdminOrderNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setPanelOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [panelOpen, setPanelOpen]);

  return (
    <div
      ref={panelRef}
      className={`relative ${className ?? ""}`}
      data-testid="admin-notification-bell"
    >
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative rounded-lg p-2 text-rose-900/45 transition hover:bg-rose-100/55 hover:text-rose-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        title="Notificaciones de pedidos"
        aria-expanded={panelOpen}
        aria-haspopup="true"
        data-testid="admin-notification-bell-btn"
      >
        <IconBell className="size-5" />
        {unreadCount > 0 ? (
          <span
            className="absolute right-1 top-1 flex min-w-[1.1rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white"
            data-testid="admin-notification-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {panelOpen ? (
        <div
          className="absolute right-0 top-full z-[80] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          data-testid="admin-notification-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Pedidos nuevos
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Marcar leídas
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No hay pedidos recientes.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
              {notifications.map((n) => {
                const href = `/admin/orders/${n.id}`;
                const kindLabel =
                  n.kind === "pedido"
                    ? pedidoChannelLabel(n.pedidoChannel)
                    : webOrderPaymentLabel(n.checkoutPaymentMethod);
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={() => {
                        markRead(n.id);
                        setPanelOpen(false);
                      }}
                      data-testid={`admin-notification-item-${n.id}`}
                      className={[
                        "block border-b border-zinc-100 px-4 py-3 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60",
                        n.read
                          ? "opacity-70"
                          : "bg-emerald-50/40 dark:bg-emerald-950/20",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          #{ventaNumeroReferencia(n.id)} · {n.customerName}
                        </p>
                        {!n.read ? (
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {n.kind === "pedido" ? "Pedido · " : "Web · "}
                        {kindLabel} · {formatCop(n.totalCents)}
                      </p>
                      <p className="sr-only">{orderNotificationSubtitle(n)}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {formatStoreDateTime(n.createdAt, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
