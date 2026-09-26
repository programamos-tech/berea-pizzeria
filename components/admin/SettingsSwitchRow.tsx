"use client";

export function SettingsSwitchRow({
  title,
  description,
  checked,
  disabled,
  onToggle,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title}: ${checked ? "encendido" : "apagado"}`}
        disabled={disabled}
        onClick={onToggle}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
          checked
            ? "border-[var(--admin-coral)] bg-[var(--admin-coral)]"
            : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800",
          disabled ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
