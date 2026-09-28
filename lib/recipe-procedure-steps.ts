/** Parse / serialize recipe procedure_text as ordered steps. */

const NUMBERED_RE = /^\s*(?:\d+[\).\-:]\s+|[-*•]\s+)/;

export function parseProcedureSteps(raw: string | null | undefined): string[] {
  const text = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  // Prefer blank-line separated blocks when present.
  if (/\n\s*\n/.test(text)) {
    return text
      .split(/\n\s*\n+/)
      .map((block) =>
        block
          .split("\n")
          .map((l) => l.replace(NUMBERED_RE, "").trim())
          .filter(Boolean)
          .join(" "),
      )
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines.map((l) => l.replace(NUMBERED_RE, "").trim()).filter(Boolean);
  }

  // Single paragraph: split on "; " or ". " when it looks like multiple clauses.
  const one = lines[0] ?? text;
  if (/;\s+/.test(one) && one.split(/;\s+/).length >= 2) {
    return one
      .split(/;\s+/)
      .map((s) => s.replace(/\.$/, "").trim())
      .filter(Boolean);
  }

  return [one];
}

export function serializeProcedureSteps(steps: string[]): string {
  return steps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
}
