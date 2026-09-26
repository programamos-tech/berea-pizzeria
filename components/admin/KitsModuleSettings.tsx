"use client";

import { useState, useTransition } from "react";
import { updateKitsEnabledAction } from "@/app/actions/admin/platform-settings";
import { SettingsSwitchRow } from "@/components/admin/SettingsSwitchRow";

export function KitsModuleSettings({
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
      const result = await updateKitsEnabledAction(next);
      if (!result.ok) setOn(!next);
    });
  }

  return (
    <SettingsSwitchRow
      title="Kits"
      description="Combos de varios productos que se venden como uno solo, con precio fijo o con descuento sobre la suma."
      checked={on}
      disabled={!canEdit || pending}
      onToggle={toggle}
    />
  );
}
