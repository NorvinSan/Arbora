import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getAuthorizedMedia } from "@/lib/person-media";
import { mediaStorage } from "@/lib/media-storage";
import { uuidSchema } from "@/lib/media-validation";

export async function GET(request: Request, { params }: { params: Promise<{ treeId: string; mediaId: string }> }) {
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 401 });
  const { treeId, mediaId } = await params;
  if (!uuidSchema.safeParse(treeId).success || !uuidSchema.safeParse(mediaId).success) return new Response(null, { status: 404 });
  const photo = await getAuthorizedMedia(session.user.id, treeId, mediaId);
  if (!photo) return new Response(null, { status: 404 });
  try {
    const bytes = await mediaStorage.get(photo.storage_key);
    return new NextResponse(Buffer.from(bytes), { headers: {
      "Content-Type": photo.mime_type,
       "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(photo.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Photo read failed", error);
    return new Response(null, { status: 404 });
  }
}
