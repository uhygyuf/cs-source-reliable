/**
 * Model-facing tool declarations for cs-source-reliable.
 * Kept separate from index.js so tests can measure the exact prompt footprint
 * (name + description + parameters) without loading DSH runtime modules.
 */
export const FIND_TOOL = {
  name: 'cs_source_find',
  description:
    'Find CS knowledge sources in a verified registry (119 entries) by URL, keyword, or CS2023 area code. '
    + 'Returns authority tier, evidence type, content access mode, license class and refresh interval. '
    + 'Use before teaching version-sensitive or current CS facts.',
  parameters: {
    query: { type: 'string', description: 'Keywords, e.g. "algorithm textbook" or "RFC". Optional when url or ka is set.' },
    url: { type: 'string', description: 'A URL or page to locate in the registry (matches host and path prefix).' },
    ka: { type: 'string', description: 'CS2023 knowledge area code: AL, AR, CN, DM, DS, FPL, GV, HCI, IS, MSF, OS, PDC, SEC, SE, SEP, SF, SPD.' },
    layer: { type: 'string', enum: ['breadth', 'depth'], description: 'Restrict to teaching-layer or frontier-layer sources.' },
    limit: { type: 'integer', description: 'Max results (default 5, ceiling 20).' },
  },
};

export const AUDIT_TOOL = {
  name: 'cs_source_audit',
  description:
    'Audit URL citations in a draft answer against the CS source registry: mark each URL as a known/unknown source, '
    + 'report its authority tier and access mode, count paragraphs with no source, and suggest fixes.',
  parameters: {
    text: { type: 'string', description: 'Draft answer text to audit; URLs are extracted from it.' },
    maxCitations: { type: 'integer', description: 'Max URLs to audit (default 20, ceiling 50).' },
  },
};

/** Exact model-facing JSON size of one tool declaration. */
export function declarationChars(tool) {
  return JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.parameters }).length;
}
