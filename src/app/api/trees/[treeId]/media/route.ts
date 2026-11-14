import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { uploadDocument, uploadPhoto } from "@/lib/person-media";
import { MAX_DOCUMENT_SIZE, MAX_PHOTO_SIZE, uuidSchema } from "@/lib/media-validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ treeId: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 });
  const { treeId } = await params;
  if (!uuidSchema.safeParse(treeId).success) return NextResponse.json({ message: "Árbol inválido." }, { status: 400 });
  // Bound the multipart body even when the client omits Content-Length.
  const limit = MAX_DOCUMENT_SIZE + 64 * 1024;
  const length = Number(request.headers.get("content-length"));
  if (length > limit) return NextResponse.json({ message: "El archivo supera 20 MB." }, { status: 413 });
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data;") || !request.body) {
    return NextResponse.json({ message: "Se esperaba un formulario de fotografía." }, { status: 400 });
  }
  try {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let total = 0;
    const reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return NextResponse.json({ message: "El archivo supera 20 MB." }, { status: 413 });
      }
      chunks.push(new Uint8Array(value));
    }
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: new Blob(chunks) }).formData();
    const file = form.get("file");
    const kind = form.get("kind") ?? "photo";
    const description = form.get("description");
    const personIds = form.getAll("personId");
    if (file instanceof File && file.size > (kind === "document" ? MAX_DOCUMENT_SIZE : MAX_PHOTO_SIZE)) {
      return NextResponse.json({ message: "El archivo supera el tamaño permitido." }, { status: 413 });
    }
    if (!(file instanceof File) || (kind !== "photo" && kind !== "document") || typeof description !== "string" ||
      personIds.length < 1 || personIds.length > 50 || !personIds.every((id) => typeof id === "string" && uuidSchema.safeParse(id).success)) {
      return NextResponse.json({ message: "Archivo o familiares inválidos." }, { status: 400 });
    }
    const result = kind === "photo" ? await uploadPhoto(session.user.id, treeId, file, description, personIds as string[]) :
      await uploadDocument(session.user.id, treeId, file, { description, personIds: personIds as string[],
        title: form.get("title"), documentType: form.get("documentType"), historicalDate: form.get("historicalDate") } as Parameters<typeof uploadDocument>[3]);
    if (!result.ok) return NextResponse.json(result, { status: result.message.includes("permiso") ? 403 : 400 });
    revalidatePath("/dashboard/trees/[treeId]/people/[personId]", "page");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Media upload failed", error);
    return NextResponse.json({ message: "No se pudo subir el archivo." }, { status: 500 });
  }
}
