import { z } from "zod";

import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/files/pipeline";

/**
 * Zod schemas for the file-upload pipeline (§9.4). No `patientId` in any body —
 * it's auth-derived via getCurrentPatient() (9.6:2755), and the upload path is
 * re-derived server-side from the auth'd patient, so a client can neither name
 * another patient nor smuggle one through the body.
 */

const mimeTypeSchema = z.enum(ACCEPTED_UPLOAD_MIME_TYPES);

// POST /api/files/sign — request a signed upload URL for a file the browser
// will PUT directly to storage.
export const signUploadSchema = z
  .object({
    filename: z.string().min(1).max(255),
    mimeType: mimeTypeSchema,
    // Advisory: lets us reject an obviously-oversized file before issuing an
    // upload URL. Client-reported, so not a trust boundary — the real cap is
    // enforced at /process after download, and the bucket's file-size limit is
    // the hard backstop.
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES).optional(),
  })
  .strict();

// POST /api/files/process — after the PUT lands, create the Report + run
// extraction over the stored object at `path`.
export const processUploadSchema = z
  .object({
    path: z.string().min(1),
    mimeType: mimeTypeSchema,
  })
  .strict();

export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type ProcessUploadInput = z.infer<typeof processUploadSchema>;
