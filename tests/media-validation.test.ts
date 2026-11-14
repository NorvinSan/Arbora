import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DOCUMENT_SIZE, MAX_PHOTO_SIZE, documentMetadataSchema, validateDocument, validatePhoto } from "../src/lib/media-validation";

test("fotografías: valida formato real, tipo declarado y tamaño", () => {
  const jpeg = Uint8Array.from([255, 216, 255, 0]);
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const webp = new TextEncoder().encode("RIFF1234WEBP");
  assert.equal(validatePhoto(jpeg, "image/jpeg", jpeg.length), null);
  assert.equal(validatePhoto(png, "image/png", png.length), null);
  assert.equal(validatePhoto(webp, "image/webp", webp.length), null);
  assert.match(validatePhoto(jpeg, "image/png", jpeg.length)!, /Solo se permiten/);
  assert.match(validatePhoto(png, "application/pdf", png.length)!, /Solo se permiten/);
  assert.match(validatePhoto(jpeg, "image/jpeg", MAX_PHOTO_SIZE + 1)!, /10 MB/);
  assert.match(validatePhoto(new Uint8Array(), "image/jpeg", 0)!, /10 MB/);
});

test("documentos: valida PDF real, MIME, límite y metadatos", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n%%EOF\n");
  assert.equal(validateDocument(pdf, "application/pdf", pdf.length), null);
  assert.match(validateDocument(pdf, "image/png", pdf.length)!, /PDF/);
  assert.match(validateDocument(new TextEncoder().encode("%PDF-1.4"), "application/pdf", 8)!, /PDF/);
  assert.match(validateDocument(pdf, "application/pdf", MAX_DOCUMENT_SIZE + 1)!, /20 MB/);
  assert.match(validateDocument(new Uint8Array(), "application/pdf", 0)!, /20 MB/);
  const id = "00000000-0000-4000-8000-000000000001";
  const data = { treeId: id, mediaId: id, title: "  Acta  ", description: "", documentType: "birth", historicalDate: "1901-02-28", personIds: [id] };
  assert.equal(documentMetadataSchema.parse(data).title, "Acta");
  assert.equal(documentMetadataSchema.safeParse({ ...data, historicalDate: "1901-02-29" }).success, false);
  assert.equal(documentMetadataSchema.safeParse({ ...data, personIds: [id, id] }).success, false);
  assert.equal(documentMetadataSchema.safeParse({ ...data, documentType: "executable" }).success, false);
});
