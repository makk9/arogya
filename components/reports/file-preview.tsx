"use client";

import { useEffect, useState } from "react";

/**
 * FilePreview — renders an uploaded source file from a signed URL (§9.4:2613).
 * Consumed by the E3 confirmation source panel and the §6.7 Report detail page;
 * the signed URL is generated per page load server-side (no client caching).
 *
 * Branches by MIME type:
 *  - images → inline preview; click expands to a full-resolution lightbox
 *  - PDFs   → inline first-page-onward embed via <iframe>; opens full in a new tab
 *  - other  → download link fallback
 *
 * Deviations from 9.4:2614, noted: uses a plain <img>, not next/image — the URL
 * is signed + short-lived (3600s) and host-dynamic, so the image optimizer would
 * need remotePatterns config and would cache a URL that expires. Multi-page PDF
 * `1 of N` navigation (9.4:2615) is deferred — the browser's native PDF viewer
 * in the iframe handles paging; a react-pdf page counter is a later polish.
 */

export interface FilePreviewProps {
  url: string;
  mimeType: string;
  filename: string;
}

export function FilePreview({ url, mimeType, filename }: FilePreviewProps) {
  if (mimeType.startsWith("image/")) {
    return <ImagePreview url={url} filename={filename} />;
  }
  if (mimeType === "application/pdf") {
    return <PdfPreview url={url} filename={filename} />;
  }
  return (
    <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
      <p>Preview isn&apos;t available for this file type.</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link underline underline-offset-2"
      >
        Download {filename}
      </a>
    </div>
  );
}

function ImagePreview({ url, filename }: { url: string; filename: string }) {
  const [zoomed, setZoomed] = useState(false);

  // Esc closes the lightbox; lock body scroll while open.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomed]);

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block w-full overflow-hidden rounded-lg border border-border bg-muted"
        aria-label={`Zoom ${filename}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived, host-dynamic URL; see component header */}
        <img
          src={url}
          alt={filename}
          className="h-auto w-full object-contain"
        />
      </button>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${filename} full resolution`}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            src={url}
            alt={filename}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}

function PdfPreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <iframe
        src={url}
        title={filename}
        className="h-[28rem] w-full bg-muted"
      />
      <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate">{filename}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-link underline underline-offset-2"
        >
          Open full PDF →
        </a>
      </div>
    </div>
  );
}
