import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { exportTreeGedcom } from "@/lib/gedcom-export";
import { uuidSchema } from "@/lib/media-validation";

export async function POST(_request: Request, { params }: { params: Promise<{ treeId: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Inicia sesión para exportar el árbol." }, { status: 401 });
  const { treeId } = await params;
  if (!uuidSchema.safeParse(treeId).success) return NextResponse.json({ message: "Árbol inválido." }, { status: 400 });
  try {
    const result = await exportTreeGedcom(session.user.id, treeId);
    if (!result) return NextResponse.json({ message: "No tienes permiso para exportar este árbol." }, { status: 403 });
    const slug = result.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "arbol";
    const fileName = `${slug}-${treeId.slice(0, 8)}.ged`;
    return new Response(result.content, {
      headers: {
        "Content-Type": "text/vnd.gedcom; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GEDCOM export failed", error);
    return NextResponse.json({ message: "No se pudo exportar el árbol. Inténtalo de nuevo." }, { status: 500 });
  }
}
