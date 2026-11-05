// Evidence vault — private storage outside any web root.
// Files are stored under randomized keys; access only via authorised,
// short-lived signed URLs or an authenticated streaming endpoint.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env.js";

const VAULT_ROOT = path.resolve(process.cwd(), env.EVIDENCE_DIR);

// Per-kind subfolders + randomized file names; never trust client names.
export function vaultPathFor(kind: string, storageKey: string): string {
  // Reject path traversal of any form
  if (storageKey.includes("..") || storageKey.startsWith("/") || storageKey.includes("\\")) {
    throw new Error("Invalid storage key");
  }
  return path.join(VAULT_ROOT, storageKey);
}

export function ensureVault(): void {
  fs.mkdirSync(VAULT_ROOT, { recursive: true });
}

export function newStorageKey(kind: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
  const date = new Date().toISOString().slice(0, 10); // yyyy-mm-dd partition
  const rand = crypto.randomBytes(16).toString("hex");
  return path.posix.join(kind + "s", date, `${rand}.${safeExt}`);
}

export function writeEvidence(storageKey: string, data: Buffer): void {
  const abs = vaultPathFor("any", storageKey);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
}

export function readEvidence(storageKey: string): Buffer {
  return fs.readFileSync(vaultPathFor("any", storageKey));
}

export function evidenceStat(storageKey: string): { size: number; mtime: Date } | null {
  try {
    const st = fs.statSync(vaultPathFor("any", storageKey));
    return { size: st.size, mtime: st.mtime };
  } catch {
    return null;
  }
}

export function deleteEvidence(storageKey: string): void {
  try {
    fs.unlinkSync(vaultPathFor("any", storageKey));
  } catch {
    /* already gone */
  }
}

// Content-based type sniffing (never trust client MIME alone)
export function detectContentKind(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: "image/png", ext: "png" };
  // WEBP (RIFF....WEBP)
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  // GIF
  if (buf.slice(0, 3).toString() === "GIF") return { mime: "image/gif", ext: "gif" };
  // PDF
  if (buf.slice(0, 5).toString() === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  // MP4/MOV: ftyp box
  if (buf.slice(4, 8).toString() === "ftyp") {
    const brand = buf.slice(8, 12).toString();
    if (brand.startsWith("qt")) return { mime: "video/quicktime", ext: "mov" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  // WEBM / MKV: EBML header
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: "video/webm", ext: "webm" };
  // OGG
  if (buf.slice(0, 4).toString() === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  // WAV
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WAVE") return { mime: "audio/x-wav", ext: "wav" };
  // MP3 (ID3 or frame sync)
  if (buf.slice(0, 3).toString() === "ID3") return { mime: "audio/mpeg", ext: "mp3" };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { mime: "audio/mpeg", ext: "mp3" };
  // M4A (ftyp M4A_)
  if (buf.slice(4, 8).toString() === "ftyp" && buf.slice(8, 11).toString() === "M4A") return { mime: "audio/mp4", ext: "m4a" };
  return null;
}

export function computeSha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
