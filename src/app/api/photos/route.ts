import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { isISODate, todayInTimeZone, addDays } from "@/lib/dates";
import { PHOTO_POSES, type PhotoPose } from "@/lib/domain";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { progressPhotoData, progressPhotos } from "@/server/db/schema";
import { forbidden, sameOrigin, unauthorized } from "@/server/http";

const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_THUMB = 600 * 1024;

/** Verifies JPEG / WebP magic bytes (never trust the declared content type). */
function sniff(buf: Buffer): "image/jpeg" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Upload one compressed photo (+ thumbnail). Multipart fields: image, thumbnail, date, pose, width, height, note. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbidden();
  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const image = form.get("image");
  const thumb = form.get("thumbnail");
  const date = String(form.get("date") ?? "");
  const pose = String(form.get("pose") ?? "front") as PhotoPose;
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  const note = String(form.get("note") ?? "").slice(0, 500) || null;

  if (!(image instanceof File) || !(thumb instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (image.size > MAX_IMAGE || thumb.size > MAX_THUMB) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const today = todayInTimeZone(user.profile.timezone);
  if (!isISODate(date) || date > addDays(today, 1)) return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  if (!PHOTO_POSES.includes(pose)) return NextResponse.json({ error: "invalid_pose" }, { status: 400 });
  if (!(width > 0 && width < 10000 && height > 0 && height < 10000)) return NextResponse.json({ error: "invalid_size" }, { status: 400 });

  const imageBuf = Buffer.from(await image.arrayBuffer());
  const thumbBuf = Buffer.from(await thumb.arrayBuffer());
  const mime = sniff(imageBuf);
  if (!mime || !sniff(thumbBuf)) return NextResponse.json({ error: "unsupported" }, { status: 415 });

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(progressPhotos)
      .values({ userId: user.id, date, pose, note, width: Math.round(width), height: Math.round(height), mimeType: mime, sizeBytes: imageBuf.length })
      .returning({ id: progressPhotos.id });
    await tx.insert(progressPhotoData).values({ photoId: row.id, image: imageBuf, thumbnail: thumbBuf });
    return row.id;
  });
  revalidatePath("/progress/photos");
  return NextResponse.json({ id }, { status: 201 });
}
