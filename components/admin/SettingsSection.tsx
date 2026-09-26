import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { adminPanelClass } from "@/lib/admin-ui";

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${adminPanelClass} scroll-mt-6 overflow-hidden`}>
      <header className="flex items-start gap-3 border-b border-zinc-100 px-4 py-4 sm:px-6 dark:border-zinc-800">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-coral)_12%,white)] text-[var(--admin-coral)] dark:bg-[color-mix(in_srgb,var(--admin-coral)_18%,transparent)]">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </header>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}
