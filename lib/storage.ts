import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

export const STORAGE_BUCKET = "arogya";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export type UploadInput = Blob | ArrayBuffer | ArrayBufferView | Buffer;

/**
 * Patient-namespaced upload path per design.md 9.4:2546 —
 * `patients/{patient_id}/uploads/{timestamp}-{filename}`. The filename is
 * sanitized (storage keys are URL path segments) but its extension is preserved.
 * The /process endpoint re-derives the prefix from the auth'd patient and
 * rejects any path that doesn't match, so the timestamp/name here is cosmetic,
 * not a trust boundary.
 */
export function uploadPathPrefix(patientId: string): string {
  return `patients/${patientId}/uploads/`;
}

export function buildUploadPath(patientId: string, filename: string): string {
  const safeName =
    filename
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "upload";
  return `${uploadPathPrefix(patientId)}${Date.now()}-${safeName}`;
}

/**
 * Creates a one-shot signed upload URL the browser PUTs the file to directly,
 * avoiding a round-trip through our server (design.md 9.4:2528). Supabase's
 * signed upload URL also yields a `token`, returned for clients that prefer
 * `uploadToSignedUrl` over a raw PUT.
 */
export async function createSignedUploadUrl(
  path: string,
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    throw new Error(`storage.createSignedUploadUrl failed: ${error.message}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/**
 * Downloads a stored object's bytes (server-side) for handoff to the extraction
 * agent. Returns the raw bytes + the content type Supabase reports.
 */
export async function downloadFile(
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(path);

  if (error) {
    throw new Error(`storage.downloadFile failed: ${error.message}`);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { bytes, contentType: data.type || null };
}

export async function uploadFile(
  path: string,
  file: UploadInput,
  contentType?: string,
): Promise<{ path: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`storage.uploadFile failed: ${error.message}`);
  }
  return { path: data.path };
}

export async function getSignedUrl(
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`storage.getSignedUrl failed: ${error.message}`);
  }
  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`storage.deleteFile failed: ${error.message}`);
  }
}
