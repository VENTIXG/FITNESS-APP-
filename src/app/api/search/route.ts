import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { globalSearch } from "@/server/queries/search";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ exercises: [], foods: [], meals: [], recipes: [], workouts: [], programs: [] });
  const results = await globalSearch(user.id, q);
  return NextResponse.json(results, { headers: { "Cache-Control": "private, no-store" } });
}
