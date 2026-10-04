import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { Smartphone, Watch } from "lucide-react";
import { SettingsCard } from "@/components/settings/forms";
import { SettingsFrame } from "@/components/settings/settings-page";
import { TokenManager } from "@/components/settings/tokens";
import { Badge } from "@/components/ui/data-display";
import { addDays } from "@/lib/dates";
import { IMPORTED_SOURCES, type DataSource } from "@/lib/domain";
import { getUserContext } from "@/server/context";
import { db } from "@/server/db";
import { apiTokens, stepEntries, weightEntries } from "@/server/db/schema";

export default async function IntegrationsPage() {
  const ctx = await getUserContext();
  const { t, fmt } = ctx;
  const ti = t.integrations;
  const since = addDays(ctx.today, -14);
  const [tokens, steps, weights] = await Promise.all([
    db.select().from(apiTokens).where(and(eq(apiTokens.userId, ctx.userId), isNull(apiTokens.revokedAt))).orderBy(desc(apiTokens.createdAt)),
    db
      .select({ source: stepEntries.source, n: sql<number>`count(*)`.mapWith(Number), last: sql<string>`max(${stepEntries.date})` })
      .from(stepEntries)
      .where(and(eq(stepEntries.userId, ctx.userId), gte(stepEntries.date, since), inArray(stepEntries.source, [...IMPORTED_SOURCES])))
      .groupBy(stepEntries.source),
    db
      .select({ source: weightEntries.source, n: sql<number>`count(*)`.mapWith(Number), last: sql<string>`max(${weightEntries.date})` })
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, ctx.userId), gte(weightEntries.date, since), inArray(weightEntries.source, [...IMPORTED_SOURCES])))
      .groupBy(weightEntries.source),
  ]);
  const lastBySource = new Map<string, string>();
  for (const r of [...steps, ...weights]) if (!lastBySource.has(r.source) || r.last > lastBySource.get(r.source)!) lastBySource.set(r.source, r.last);
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "https://your-domain";
  const example = `curl -X POST ${appUrl}/api/ingest \\
  -H "Authorization: Bearer forge_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "apple_health",
    "steps":   [{ "date": "${ctx.today}", "steps": 8423 }],
    "weights": [{ "date": "${ctx.today}", "weightKg": 82.4 }],
    "sleep":   [{ "date": "${ctx.today}", "bedTime": "23:10", "wakeTime": "07:02" }],
    "metrics": [{ "date": "${ctx.today}", "metric": "resting_hr", "value": 54 }],
    "cardio":  [{ "date": "${ctx.today}", "activity": "running", "durationSeconds": 1820,
                 "distanceM": 5000, "avgHeartRate": 152, "externalId": "hk-123" }]
  }'`;
  const status = (source: DataSource) => {
    const last = lastBySource.get(source);
    return last ? (
      <Badge tone="good">
        {ti.receivingData} · {fmt.date(last, "dayMonth")}
      </Badge>
    ) : (
      <Badge tone="outline">{ti.notConnected}</Badge>
    );
  };
  return (
    <SettingsFrame section="integrations">
      <p className="text-sm text-fg-2">{ti.intro}</p>
      <SettingsCard title={ti.appleHealth}>
        <div className="flex items-start gap-3">
          <Watch className="mt-0.5 size-5 shrink-0 text-fg-3" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm text-fg-2">{ti.appleHealthBody}</p>
            {status("apple_health")}
          </div>
        </div>
      </SettingsCard>
      <SettingsCard title={ti.healthConnect}>
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-fg-3" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm text-fg-2">{ti.healthConnectBody}</p>
            {status("health_connect")}
          </div>
        </div>
      </SettingsCard>
      <SettingsCard title={ti.apiTokens} description={ti.apiTokensHint}>
        <TokenManager tokens={tokens.map((x) => ({ id: x.id, name: x.name, prefix: x.prefix, lastUsedAt: x.lastUsedAt?.toISOString() ?? null, createdAt: x.createdAt.toISOString() }))} />
      </SettingsCard>
      <SettingsCard title={ti.endpoint}>
        <code className="block rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">POST {appUrl}/api/ingest</code>
        <h3 className="mt-4 mb-2 text-sm font-semibold">{ti.payloadExample}</h3>
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-fg-2">{example}</pre>
        <p className="mt-3 text-xs text-fg-3">{ti.docs}</p>
      </SettingsCard>
    </SettingsFrame>
  );
}
