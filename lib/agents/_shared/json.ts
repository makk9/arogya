/**
 * Pulls the JSON payload out of a model reply that was asked for "JSON only".
 * Models still sometimes wrap it in a ```json fence and add a line of prose
 * before or after — the old whole-string fence regex only matched a reply that
 * was *exactly* one fence, so any stray sentence became a parse_failure (a
 * quick-log like "BP was high today" landed on "I couldn't reliably read this").
 *
 * Order: the bare reply if it already parses → the first fenced block → the
 * outermost `{…}` span. Returns the best candidate string; the caller still
 * JSON.parses and schema-validates it.
 */
export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  if (isJson(trimmed)) return trimmed;

  const fence = trimmed.match(/```(?:json)?[ \t]*\n?([\s\S]*?)\n?```/);
  if (fence && isJson(fence[1].trim())) return fence[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const span = trimmed.slice(start, end + 1);
    if (isJson(span)) return span;
  }
  return fence ? fence[1].trim() : trimmed;
}

function isJson(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}
