import { APP_NAME } from "@/lib/config";
import { routeContext, unauthorized } from "@/server/http";
import { exportUserData } from "@/server/services/backup";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await routeContext();
  if (!ctx) return unauthorized();
  const photos = new URL(req.url).searchParams.get("photos") === "1";
  const data = await exportUserData(ctx.userId, { photos });
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_NAME.toLowerCase()}-backup-${ctx.today}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
