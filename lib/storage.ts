import "server-only";

import { supabaseAdmin } from "@/lib/supabase";

export const STORAGE_BUCKET = "arogya";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export type UploadInput = Blob | ArrayBuffer | ArrayBufferView | Buffer;

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
