import {
  MENU_ITEM_KIND_LABEL,
  type MenuItemKind,
} from "@/lib/menu-item-kind";

const styles: Record<MenuItemKind, string> = {
  elaborado:
    "bg-amber-50 text-amber-950 ring-amber-200/90 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/55",
  reventa:
    "bg-sky-50 text-sky-950 ring-sky-200/90 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-800/55",
};

export function MenuItemKindBadge({
  kind,
  className = "",
}: {
  kind: MenuItemKind;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles[kind]} ${className}`}
    >
      {MENU_ITEM_KIND_LABEL[kind]}
    </span>
  );
}
