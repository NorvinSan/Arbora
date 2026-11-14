import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// A private, replaceable storage boundary. Keys never contain user-supplied paths.
export interface MediaStorage {
  put(treeId: string, bytes: Uint8Array): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

const root = process.env.MEDIA_STORAGE_DIR ?? join(process.cwd(), ".data", "media");
const keyPattern = /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/;
function filePath(key: string) {
  if (!keyPattern.test(key)) throw new Error("Invalid storage key");
  return join(/* turbopackIgnore: true */ root, key);
}

export const mediaStorage: MediaStorage = {
  async put(treeId, bytes) {
    const key = `${treeId}/${randomUUID()}`;
    const path = filePath(key);
    await mkdir(join(/* turbopackIgnore: true */ root, treeId), { recursive: true });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    return key;
  },
  async get(key) { return readFile(/* turbopackIgnore: true */ filePath(key)); },
  async remove(key) {
    try { await unlink(filePath(key)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  },
};
