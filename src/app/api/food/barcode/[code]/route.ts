import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { routeContext, unauthorized } from "@/server/http";
import { db } from "@/server/db";
import { foods } from "@/server/db/schema";
import { lookupOff, offEnabled } from "@/server/openfoodfacts";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/food/barcode/[code]">) {
  const ctx = await routeContext();
  if (!ctx) return unauthorized();
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) return NextResponse.json({ error: "validation" }, { status: 400 });
  const local = (
    await db
      .select({ id: foods.id })
      .from(foods)
      .where(and(eq(foods.barcode, code), isNull(foods.archivedAt), or(isNull(foods.userId), eq(foods.userId, ctx.userId))))
      .limit(1)
  )[0];
  if (local) return NextResponse.json({ found: "local", foodId: local.id });
  if (!offEnabled()) return NextResponse.json({ found: null, online: "disabled" });
  const off = await lookupOff(code);
  if (off === "unavailable") return NextResponse.json({ found: null, online: "unavailable" });
  if (!off) return NextResponse.json({ found: null });
  return NextResponse.json({ found: "off", product: off });
}
