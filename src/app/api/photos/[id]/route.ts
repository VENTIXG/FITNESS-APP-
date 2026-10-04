import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { progressPhotoData, progressPhotos } from "@/server/db/schema";
import { unauthorized } from "@/server/http";

/** Streams a private photo to its owner only. Never cached by shared caches. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/photos/[id]">) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const thumb = request.nextUrl.searchParams.get("size") === "thumb";
  const row = (
    await db
      .select({ mime: progressPhotos.mimeType, data: thumb ? progressPhotoData.thumbnail : progressPhotoData.image })
      .from(progressPhotos)
      .innerJoin(progressPhotoData, eq(progressPhotoData.photoId, progressPhotos.id))
      .where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, user.id)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Robots-Tag": "noindex, noimageindex",
      "Content-Disposition": "inline",
    },
  });
}
