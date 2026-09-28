import Link from "next/link";
import { ChefHat, CircleCheck, ListOrdered } from "lucide-react";
import { parseProcedureSteps } from "@/lib/recipe-procedure-steps";

const STEP_ICONS = [ListOrdered, CircleCheck, ChefHat] as const;

type Props = {
  procedureText: string;
  editHref?: string | null;
  canEdit?: boolean;
};

export function RecipeProcedureSteps({
  procedureText,
  editHref,
  canEdit = false,
}: Props) {
  const steps = parseProcedureSteps(procedureText);

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <ListOrdered
            className="size-4 shrink-0 text-zinc-500"
            strokeWidth={2.25}
            aria-hidden
          />
          Procedimiento
        </h2>
        {canEdit && editHref ? (
          <Link
            href={editHref}
            className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            {steps.length === 0 ? "Añadir pasos" : "Editar pasos"}
          </Link>
        ) : null}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <ChefHat
            className="mx-auto size-7 text-zinc-400"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="mt-2 text-sm text-zinc-500">
            Todavía no hay pasos de preparación.
          </p>
          {canEdit && editHref ? (
            <Link
              href={editHref}
              className="mt-3 inline-block text-sm font-medium text-[var(--admin-coral-deep)] hover:underline"
            >
              Añadir procedimiento
            </Link>
          ) : null}
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index % STEP_ICONS.length];
            return (
              <li
                key={`${index}-${step.slice(0, 24)}`}
                className="flex gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
                    Paso {index + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                    {step}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
