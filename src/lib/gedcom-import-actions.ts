"use server";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readGedcomFile, MAX_GEDCOM_BYTES } from "@/lib/gedcom-import";
import { importTreeGedcom } from "@/lib/gedcom-import-store";
import { validatedAction } from "@/lib/validated-action";
import type { ActionResult } from "@/lib/action-result";

const schema = z.object({ name: z.string().trim().min(1, "Ponle nombre al árbol.").max(200), file: z.custom<File>((value) => value instanceof File, "Selecciona un archivo .ged.") });
const confirmSchema = schema.extend({ token: z.string().max(300) });
type Preview = { counts: { people: number; relations: number; events: number }; warnings: string[]; errors: string[]; token: string | null };
const previewLifetime = 30 * 60 * 1000;

function signature(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Falta configurar la clave de autenticación.");
  return createHmac("sha256", secret).update(`gedcom-preview:${payload}`).digest("hex");
}
async function digest(file: File) { return createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex"); }
function isValidToken(token: string, userId: string, name: string, hash: string) {
  const [timestamp, mac, ...rest] = token.split(".");
  const time = Number(timestamp);
  if (rest.length || !/^\d{13}$/.test(timestamp ?? "") || !/^[a-f0-9]{64}$/.test(mac ?? "") || time > Date.now() || Date.now() - time > previewLifetime) return false;
  const expected = signature(`${userId}:${name}:${hash}:${timestamp}`);
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"));
}

export async function previewGedcomAction(input: unknown): Promise<ActionResult<Preview>> {
  return validatedAction<typeof schema, Preview>(input, schema, "previewGedcom", async (userId, { name, file }) => {
    if (file.size > MAX_GEDCOM_BYTES) return { ok: false, message: "El archivo supera el límite de 5 MB." };
    try {
      const parsed = await readGedcomFile(file);
      const hash = parsed.errors.length ? null : await digest(file);
      const timestamp = String(Date.now());
      const token = hash ? `${timestamp}.${signature(`${userId}:${name}:${hash}:${timestamp}`)}` : null;
      return { ok: true, counts: parsed.counts, warnings: parsed.warnings, errors: parsed.errors, token };
    } catch (error) {
      return { ok: true, counts: { people: 0, relations: 0, events: 0 }, warnings: [], errors: [error instanceof Error ? error.message : "No se pudo leer el archivo."], token: null };
    }
  }, () => {}, () => "No se pudo preparar la vista previa.");
}

export async function confirmGedcomAction(input: unknown): Promise<ActionResult<{ treeId: string; counts: Preview["counts"] }>> {
  return validatedAction(input, confirmSchema, "confirmGedcom", async (userId, { name, file, token }) => {
    if (file.size === 0 || file.size > MAX_GEDCOM_BYTES || !file.name.toLowerCase().endsWith(".ged")) return { ok: false, message: "Archivo GEDCOM inválido." };
    if (!isValidToken(token, userId, name, await digest(file))) return { ok: false, message: "La vista previa ha caducado o el archivo ha cambiado. Vuelve a revisarlo." };
    let parsed;
    try { parsed = await readGedcomFile(file); }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Archivo inválido." }; }
    if (parsed.errors.length) return { ok: false, message: parsed.errors[0] };
    return importTreeGedcom(userId, name, parsed);
  }, () => revalidatePath("/dashboard"), () => "No se pudo importar el archivo. No se guardó ningún registro.");
}
