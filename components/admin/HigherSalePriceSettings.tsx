"use client";

import { useState, useTransition } from "react";
import {
  updatePosPriceFlagAction,
  type PosPriceFlag,
} from "@/app/actions/admin/platform-settings";
import { SettingsSwitchRow } from "@/components/admin/SettingsSwitchRow";

const COPY: Record<PosPriceFlag, { title: string; detail: string }> = {
  below: {
    title: "Vender por debajo del precio de venta",
    detail:
      "Permite cobrar menos que el precio de lista, incluso $0, con el campo Cobrar o con descuentos. Apagado, nunca se vende por menos del precio de venta.",
  },
  higher: {
    title: "Vender por encima del precio de venta",
    detail:
      "Permite cobrar más que el precio de lista. El precio cobrado es el valor final del ticket.",
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
    <SettingsSwitchRow
      title={title}
      description={detail}
      checked={on}
      disabled={!canEdit || pending}
      onToggle={toggle}
    />
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
    <>
      <PosPriceFlagToggle flag="below" enabled={allowBelow} canEdit={canEdit} />
      <PosPriceFlagToggle flag="higher" enabled={allowHigher} canEdit={canEdit} />
    </>
  );
}
