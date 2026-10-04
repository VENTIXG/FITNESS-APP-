import { DatabaseZap } from "lucide-react";
import { getT } from "@/server/context";

/** Friendly setup message when the database is missing, unreachable or not migrated. */
export async function DatabaseUnavailable() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-surface p-7 text-center shadow-pop">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-critical/10 text-critical-text">
        <DatabaseZap className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">{t.errors.databaseTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-3">{t.errors.databaseBody}</p>
    </div>
  );
}
