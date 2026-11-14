import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PHOTO_SIZE, validatePhoto } from "../src/lib/media-validation";

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
