/**
 * System-prompt guidance text for cs-source-reliable.
 * Kept separate so tests can measure its token footprint without loading DSH modules.
 */
export const SECTION_ORDER = 240; // plugin guidance band: after plugin tool sections (150-220), before PLAN_POLICY (500)

export function buildGuidance(stats) {
  return [
    '## Source reliability (cs-source-reliable)',
    `The bundled registry has ${stats.count} verified CS sources (${stats.by_layer.breadth} teaching, ${stats.by_layer.depth} frontier).`,
    'Before stating CS facts that depend on versions, APIs, standards, or current state:',
    '1. call cs_source_find with a query, a URL, or a CS2023 area code;',
    '2. prefer A (primary spec/official docs/releases) or B (peer-reviewed/authoritative) sources; treat C as secondary and D as a lead, never as fact;',
    '3. cite as "[source-id] URL" plus the version or date the source states, and say "unsourced" when no registry source fits.',
    'Call cs_source_audit on a draft that cites URLs before sending it.',
    'Skip both tools for non-CS topics.',
  ].join('\n');
}
