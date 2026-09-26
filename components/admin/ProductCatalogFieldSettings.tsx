"use client";

import { useState, useTransition } from "react";
import { updateProductCatalogFieldAction } from "@/app/actions/admin/platform-settings";
import { SettingsSwitchRow } from "@/components/admin/SettingsSwitchRow";
import {
  PRODUCT_CATALOG_FIELDS,
  type ProductCatalogFields,
} from "@/lib/product-catalog-fields";

export function ProductCatalogFieldSettings({
  fields,
  canEdit,
}: {
  fields: ProductCatalogFields;
  canEdit: boolean;
}) {
  const [values, setValues] = useState(fields);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: keyof ProductCatalogFields) {
    if (!canEdit || pendingId) return;
    const next = !values[id];
    setValues((prev) => ({ ...prev, [id]: next }));
    setPendingId(id);
    startTransition(async () => {
      const result = await updateProductCatalogFieldAction(id, next);
      if (!result.ok) {
        setValues((prev) => ({ ...prev, [id]: !next }));
      }
      setPendingId(null);
    });
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {PRODUCT_CATALOG_FIELDS.map((field) => (
        <SettingsSwitchRow
          key={field.id}
          title={field.label}
          description={field.hint}
          checked={values[field.id]}
          disabled={!canEdit || pendingId === field.id}
          onToggle={() => toggle(field.id)}
        />
      ))}
    </div>
  );
}
