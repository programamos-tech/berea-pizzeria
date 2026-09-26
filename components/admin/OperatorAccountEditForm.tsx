import { updateCustomerAccountInfo } from "@/app/actions/admin/platform-accounts";
import {
  adminFilterInputClass,
  adminFilterLabelClass,
  adminToolbarBtnActiveClass,
  adminToolbarBtnBaseClass,
} from "@/lib/admin-ui";

export type AccountEditValues = {
  tenantId: string;
  holderName: string;
  holderEmail: string;
  phone: string;
  whatsapp: string;
  tradeName: string;
  legalName: string;
  taxNit: string;
  taxRegime: string;
  city: string;
  address: string;
  businessEmail: string;
};

function TextField({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className={adminFilterLabelClass}>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={adminFilterInputClass}
      />
    </label>
  );
}

export function OperatorAccountEditForm({
  values,
  saved,
  error,
}: {
  values: AccountEditValues;
  saved: boolean;
  error: "info" | "email" | null;
}) {
  return (
    <form action={updateCustomerAccountInfo} className="px-4 py-4 sm:px-5">
      <input type="hidden" name="tenant_id" value={values.tenantId} />
      {saved ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Información guardada.
        </p>
      ) : null}
      {error === "email" ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100">
          Ese correo ya está en uso. El resto no se cambió.
        </p>
      ) : null}
      {error === "info" ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100">
          No se pudo guardar. Revisa el nombre, el negocio y el correo.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="holder_name" label="Titular" defaultValue={values.holderName} required />
        <TextField name="holder_email" label="Correo" type="email" defaultValue={values.holderEmail} />
        <TextField name="phone" label="Teléfono" defaultValue={values.phone} />
        <TextField name="whatsapp" label="WhatsApp" defaultValue={values.whatsapp} />
        <TextField name="trade_name" label="Nombre comercial" defaultValue={values.tradeName} required />
        <TextField name="legal_name" label="Razón social" defaultValue={values.legalName} />
        <TextField name="tax_nit" label="NIT" defaultValue={values.taxNit} />
        <TextField name="tax_regime" label="Régimen" defaultValue={values.taxRegime} />
        <TextField name="city" label="Ciudad" defaultValue={values.city} />
        <TextField name="business_email" label="Correo del negocio" type="email" defaultValue={values.businessEmail} />
        <label className="block min-w-0 sm:col-span-2">
          <span className={adminFilterLabelClass}>Dirección</span>
          <input
            name="address"
            defaultValue={values.address}
            className={adminFilterInputClass}
          />
        </label>
      </div>
      <div className="mt-4">
        <button
          type="submit"
          className={`${adminToolbarBtnBaseClass} ${adminToolbarBtnActiveClass}`}
        >
          Guardar información
        </button>
      </div>
    </form>
  );
}
