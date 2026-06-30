/**
 * Derives a file's MIME type from its storage path extension.
 *
 * The `reports` table stores `source_file_url` (the path) but no MIME column,
 * while §9.4:2610's FilePreview needs a `mimeType` to branch on. `buildUploadPath`
 * preserves the original extension, so the path is the reliable source. Used by
 * the E3 confirmation page + §6.7 Report detail to feed FilePreview. Plain module
 * (no "server-only") so server components can call it freely.
 */

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function mimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}
