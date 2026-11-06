/**
 * Unit + performance checks for cs-source-reliable (no DSH runtime required).
 * Run: node test/check.mjs
 */
import { fileURLToPath } from 'node:url';
import { loadRegistry, findSources, auditText, registryStats } from '../lib/registry.js';
import { buildGuidance, SECTION_ORDER } from '../lib/guidance.js';
import { FIND_TOOL, AUDIT_TOOL, declarationChars } from '../lib/tool-defs.js';

const DATA = new URL('../data/sources.json', import.meta.url);
let failures = 0;
let checks = 0;

function ok(condition, label, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function ms(ns) {
  return Number(ns) / 1e6;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

/** The tool executor rejects values that do not survive a JSON round trip. */
function isLosslessJson(value) {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isLosslessJson);
  if (t === 'object') return Object.values(value).every(isLosslessJson);
  return false;
}

// ---------- load ----------
const loadStart = process.hrtime.bigint();
const registry = loadRegistry(DATA);
const loadMs = ms(process.hrtime.bigint() - loadStart);
const stats = registryStats(registry);

console.log(`\n[registry] ${stats.count} sources, ${stats.by_layer.breadth} breadth / ${stats.by_layer.depth} depth, ${stats.knowledge_areas.length} knowledge areas, load ${loadMs.toFixed(1)} ms`);
ok(stats.count === 119, 'registry has 119 sources', stats.count);
ok(stats.by_layer.breadth === 68 && stats.by_layer.depth === 51, 'layer split is 68/51', JSON.stringify(stats.by_layer));
ok(stats.knowledge_areas.length === 17, '17 CS2023 knowledge areas', stats.knowledge_areas.length);

// ---------- find ----------
const byUrl = findSources(registry, { url: 'https://docs.python.org/3/library/functions.html' });
ok(byUrl.results[0]?.id === 'python-docs', 'find by docs.python.org URL', byUrl.results[0]?.id);

const byQuery = findSources(registry, { query: 'algorithm textbook' });
ok(byQuery.results[0]?.id === 'erickson-algorithms', 'find by keyword "algorithm textbook"', byQuery.results[0]?.id);

const subjectQuery = findSources(registry, { query: 'python 3.13 release notes', limit: 3 });
ok(subjectQuery.results[0]?.id.startsWith('python'), 'subject token outranks generic tokens', subjectQuery.results.map((s) => s.id).join(','));

const dbQuery = findSources(registry, { query: 'database transactions', limit: 3 });
ok(['redbook', 'postgres-docs', 'pvldb', 'jepsen'].includes(dbQuery.results[0]?.id), 'database transactions ranks DB sources first', dbQuery.results.map((s) => s.id).join(','));

const byKa = findSources(registry, { ka: 'OS' });
ok(byKa.count >= 10, 'find by knowledge area OS returns a page', String(byKa.count));
ok(byKa.results.every((s) => (s.ka ?? []).includes('OS')), 'ka filter returns only OS sources');

const unknownUrl = findSources(registry, { url: 'https://unknown.invalid/x' });
ok(unknownUrl.count === 0, 'unknown URL returns zero matches', String(unknownUrl.count));
ok(isLosslessJson(byUrl) && isLosslessJson(byQuery) && isLosslessJson(unknownUrl), 'find output is lossless JSON');

let threw = false;
try { findSources(registry, {}); } catch { threw = true; }
ok(threw, 'empty query throws a helpful error');

// ---------- audit ----------
const draft = [
  'Python 3.13 changed the default behavior of the interactive interpreter (see https://docs.python.org/3/).',
  'This random blog says otherwise: https://example.com/some-post.',
  'A long paragraph without any URL that makes several factual claims about compilers and runtime behavior, which should be counted as uncited because it is longer than eighty characters and carries no link at all.',
].join('\n\n');
const audit = auditText(registry, { text: draft });
ok(audit.summary.total_urls === 2, 'audit finds 2 URLs', String(audit.summary.total_urls));
ok(audit.summary.known === 1, 'audit maps docs.python.org to a known source', String(audit.summary.known));
ok(audit.summary.unknown === 1, 'audit flags example.com as unknown', String(audit.summary.unknown));
ok(audit.summary.by_authority.A === 1, 'audit counts authority A', JSON.stringify(audit.summary.by_authority));
ok(audit.summary.uncited_paragraphs === 1, 'audit counts uncited paragraphs', String(audit.summary.uncited_paragraphs));
ok(audit.suggestions.length >= 2, 'audit returns suggestions', String(audit.suggestions.length));
ok(isLosslessJson(audit), 'audit output is lossless JSON');

const badTier = auditText(registry, {
  text: 'Claim: compilers are simple. Sources: https://stackoverflow.com/questions/1 and https://en.wikipedia.org/wiki/Compiler.',
});
ok(badTier.summary.by_authority.C === 1, 'audit grades Wikipedia as C', JSON.stringify(badTier.summary.by_authority));
ok(badTier.suggestions.some((s) => s.includes('D-tier') || s.includes('confirm')), 'audit warns about weak/unknown sources');

// ---------- prompt footprint ----------
const guidance = buildGuidance(stats);
const estTokens = (text) => Math.ceil(text.length / 4);
console.log(`\n[prompt] guidance ${guidance.length} chars (~${estTokens(guidance)} tokens at 4 chars/token), section order ${SECTION_ORDER}`);
ok(guidance.length < 1200, 'guidance stays under 1200 chars', String(guidance.length));

const findChars = declarationChars(FIND_TOOL);
const auditChars = declarationChars(AUDIT_TOOL);
const totalChars = findChars + auditChars + guidance.length;
const totalTokens = Math.ceil(totalChars / 4);
console.log(`[tokens] find schema ${findChars} chars (~${Math.ceil(findChars / 4)} tokens), audit schema ${auditChars} chars (~${Math.ceil(auditChars / 4)} tokens), combined ~${totalTokens} tokens per request (schemas + guidance)`);
ok(findChars + auditChars < 2500, 'two tool schemas under 2500 chars', String(findChars + auditChars));
ok(totalTokens < 700, 'combined per-request overhead under 700 tokens', String(totalTokens));

// ---------- performance ----------
const queries = [
  { query: 'python' }, { query: 'algorithm' }, { query: 'operating systems' },
  { url: 'https://docs.python.org/3/' }, { ka: 'SEC', layer: 'depth' }, { query: 'database', limit: 10 },
];
const findTimes = [];
for (let i = 0; i < 5000; i++) {
  const q = queries[i % queries.length];
  const t = process.hrtime.bigint();
  findSources(registry, q);
  findTimes.push(ms(process.hrtime.bigint() - t));
}

const auditTextLong = draft.repeat(8);
const auditTimes = [];
for (let i = 0; i < 500; i++) {
  const t = process.hrtime.bigint();
  auditText(registry, { text: auditTextLong });
  auditTimes.push(ms(process.hrtime.bigint() - t));
}

const findAvg = findTimes.reduce((a, b) => a + b, 0) / findTimes.length;
const auditAvg = auditTimes.reduce((a, b) => a + b, 0) / auditTimes.length;
console.log(`\n[perf] find: avg ${findAvg.toFixed(3)} ms, p95 ${percentile(findTimes, 95).toFixed(3)} ms, max ${Math.max(...findTimes).toFixed(3)} ms (5000 calls)`);
console.log(`[perf] audit (${auditTextLong.length} chars): avg ${auditAvg.toFixed(3)} ms, p95 ${percentile(auditTimes, 95).toFixed(3)} ms, max ${Math.max(...auditTimes).toFixed(3)} ms (500 calls)`);
console.log(`[perf] registry load: ${loadMs.toFixed(1)} ms (${(JSON.stringify(registry.meta).length / 1024).toFixed(1)} KiB meta; sources in memory)`);
ok(findAvg < 2, 'find average under 2 ms', findAvg.toFixed(3));
ok(auditAvg < 5, 'audit average under 5 ms', auditAvg.toFixed(3));
ok(loadMs < 100, 'registry load under 100 ms', loadMs.toFixed(1));

// ---------- summary ----------
console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
