"use client";

import { useAdminTheme } from "@/components/admin/AdminThemeProvider";
import {
  branchSafeAdminPath,
  writeActiveBranchCookie,
  type BranchRef,
} from "@/lib/branch-context";
import { adminProductBrand, adminSidebarLogoPath } from "@/lib/brand";
import {
  shouldUnoptimizeStorageImageUrl,
  storagePublicObjectUrl,
} from "@/lib/storage-public-url";
import { Check, ChevronDown, MapPin } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

function BranchSwitchLoading({ branchName }: { branchName: string }) {
  const theme = useAdminTheme()?.resolved ?? "light";
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-admin-theme={theme}
      className="account-switch-overlay fixed inset-0 z-[300] flex items-center justify-center bg-white dark:bg-zinc-950"
      role="status"
      aria-live="assertive"
      aria-busy="true"
      aria-label={`Cargando ${branchName}`}
    >
      <div className="flex flex-col items-center">
        <Image
          src={adminSidebarLogoPath}
          alt={adminProductBrand}
          width={480}
          height={265}
          className="account-switch-overlay-mark h-7 w-auto max-w-[8.5rem] object-contain sm:h-8 sm:max-w-[9.5rem]"
          priority
        />
        <p className="mt-4 text-[13px] font-medium tracking-tight text-zinc-400 dark:text-zinc-500">
          Cargando {branchName}…
        </p>
      </div>
    </div>,
    document.body,
  );
}

function BranchOptionMark({ branch }: { branch: BranchRef }) {
  const logoUrl = storagePublicObjectUrl(branch.logoPath);
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={28}
        height={28}
        unoptimized={shouldUnoptimizeStorageImageUrl(logoUrl)}
        className="size-7 shrink-0 rounded-md border border-zinc-200 bg-white object-cover dark:border-zinc-700"
      />
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
      {branch.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function BranchSwitcher({
  active,
  branches,
  className = "",
  appearance = "default",
}: {
  active: BranchRef;
  branches: BranchRef[];
  className?: string;
  appearance?: "default" | "bare";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [switchingBranch, setSwitchingBranch] = useState<BranchRef | null>(null);
  const [switching, startSwitch] = useTransition();
  const bare = appearance === "bare";

  const selectBranch = (branchId: string) => {
    setOpen(false);
    const selected = branches.find((branch) => branch.id === branchId);
    if (!selected || branchId === active.id) return;
    setSwitchingBranch(selected);
    writeActiveBranchCookie(branchId);
    const target = branchSafeAdminPath(pathname);
    startSwitch(() => {
      if (target !== pathname) router.replace(target);
      router.refresh();
    });
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (branches.length <= 1) {
    return (
      <div
        className={`${bare ? "flex" : "hidden rounded-lg border border-zinc-200 px-2.5 py-1.5 sm:flex dark:border-zinc-700"} items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 ${className}`}
      >
        {!bare ? <MapPin className="size-3.5" aria-hidden /> : null}
        <span className="max-w-32 truncate">{active.name}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={`${bare ? "" : "rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"} flex w-full items-center gap-1.5 text-left text-xs font-medium text-zinc-700 outline-none transition hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-400/50 dark:text-zinc-200 dark:hover:text-white`}
      >
        {!bare ? <MapPin className="size-3.5 shrink-0" aria-hidden /> : null}
        <span className="min-w-0 flex-1 truncate">{active.name}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Cambiar sucursal"
          className="absolute left-0 top-full z-[80] mt-1.5 w-full min-w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-xl shadow-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30"
        >
          {branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              role="menuitemradio"
              aria-checked={branch.id === active.id}
              onClick={() => selectBranch(branch.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-zinc-400/50 ${
                branch.id === active.id
                  ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-white"
              }`}
            >
              <BranchOptionMark branch={branch} />
              <span className="min-w-0 flex-1 truncate">{branch.name}</span>
              {branch.id === active.id ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {switching && switchingBranch ? (
        <BranchSwitchLoading branchName={switchingBranch.name} />
      ) : null}
    </div>
  );
}
