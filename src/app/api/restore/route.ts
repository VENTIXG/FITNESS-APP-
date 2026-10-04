import { NextResponse, type NextRequest } from "next/server";
import { forbidden, routeContext, sameOrigin, unauthorized } from "@/server/http";
import { isBackup, restoreUserData } from "@/server/services/backup";

export const dynamic = "force-dynamic";

const MAX_BYTES = 80 * 1024 * 1024;

/** Restores a backup. Replace mode requires the explicit confirmation word. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const ctx = await routeContext();
  if (!ctx) return unauthorized();
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  if (mode !== "merge" && mode !== "replace") return NextResponse.json({ error: "validation" }, { status: 400 });
  if (mode === "replace" && url.searchParams.get("confirm") !== "REPLACE") return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isBackup(body)) return NextResponse.json({ error: "invalid_backup" }, { status: 400 });
  try {
    const result = await restoreUserData(ctx.userId, body, mode);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("restore failed", err);
    return NextResponse.json({ error: "restore_failed" }, { status: 500 });
  }
}
