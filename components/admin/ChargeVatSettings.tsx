"use client";

import { useState, useTransition } from "react";
import { updateChargeVatAction } from "@/app/actions/admin/platform-settings";
import { SettingsSwitchRow } from "@/components/admin/SettingsSwitchRow";

export function ChargeVatSettings({
  enabled,
  canEdit,
}: {
  enabled: boolean;
  canEdit: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!canEdit || pending) return;
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const result = await updateChargeVatAction(next);
      if (!result.ok) setOn(!next);
    });
  }

  return (
    <SettingsSwitchRow
      title="Cobrar IVA"
      description={
        on
          ? "Los precios de venta suman IVA (19 %) cuando el ítem lo tiene activado. Apagalo si tu negocio no factura IVA."
          : "IVA desactivado en toda la cuenta: menú, ventas y facturas muestran el precio sin IVA."
      }
      checked={on}
      disabled={!canEdit || pending}
      onToggle={toggle}
    />
  );
}
