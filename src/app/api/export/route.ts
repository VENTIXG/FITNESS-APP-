import { NextResponse } from "next/server";
import { APP_NAME } from "@/lib/config";
import { routeContext, unauthorized } from "@/server/http";
import { buildDatasets, EXPORT_CATEGORIES, EXPORT_FORMATS, toCsv, toJson, toXlsx, type ExportCategory, type ExportFormat } from "@/server/services/export";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await routeContext();
  if (!ctx) return unauthorized();
  const url = new URL(req.url);
  const category = url.searchParams.get("category") as ExportCategory;
  const format = url.searchParams.get("format") as ExportFormat;
  if (!EXPORT_CATEGORIES.includes(category) || !EXPORT_FORMATS.includes(format)) return NextResponse.json({ error: "validation" }, { status: 400 });
  if (format === "csv" && category === "all") return NextResponse.json({ error: "csv_single_category" }, { status: 400 });
  const datasets = await buildDatasets(ctx, category);
  const base = `${APP_NAME.toLowerCase()}-${category}-${ctx.today}`;
  const headers = (type: string, ext: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${base}.${ext}"`,
    "Cache-Control": "private, no-store",
  });
  if (format === "json") return new Response(toJson(datasets), { headers: headers("application/json; charset=utf-8", "json") });
  if (format === "xlsx") {
    const buf = await toXlsx(datasets);
    return new Response(new Uint8Array(buf), { headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx") });
  }
  // A category may produce two tables (e.g. cardio + steps); CSV takes the first, the rest are available as XLSX/JSON.
  return new Response(toCsv(datasets[0]), { headers: headers("text/csv; charset=utf-8", "csv") });
}
