"use client";

import { useState, useTransition } from "react";
import {
  updatePosPriceFlagAction,
  type PosPriceFlag,
} from "@/app/actions/admin/platform-settings";

const COPY: Record<PosPriceFlag, { title: string; detail: string }> = {
  below: {
    title: "Vender por debajo del precio de venta",
    detail:
      "Permite cobrar menos que el precio de lista, incluso $0, con el campo Cobrar o con descuentos. Apagado, nunca se vende por menos del precio de venta.",
  },
  higher: {
    title: "Vender por encima del precio de venta",
    detail:
      "Permite cobrar más que el precio de lista. El precio cobrado ya incluye el IVA.",
  },
};

function PosPriceFlagToggle({
  flag,
  enabled,
  canEdit,
}: {
  flag: PosPriceFlag;
  enabled: boolean;
  canEdit: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const { title, detail } = COPY[flag];

  function toggle() {
    if (!canEdit || pending) return;
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const result = await updatePosPriceFlagAction(flag, next);
      if (!result.ok) setOn(!next);
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${title}: ${on ? "encendido" : "apagado"}`}
        disabled={!canEdit || pending}
        onClick={toggle}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
          on
            ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
            : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800",
          !canEdit || pending ? "cursor-not-allowed opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-zinc-950",
            on ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function PosPriceSettings({
  allowBelow,
  allowHigher,
  canEdit,
}: {
  allowBelow: boolean;
  allowHigher: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-5">
      <PosPriceFlagToggle flag="below" enabled={allowBelow} canEdit={canEdit} />
      <PosPriceFlagToggle flag="higher" enabled={allowHigher} canEdit={canEdit} />
    </div>
  );
}
