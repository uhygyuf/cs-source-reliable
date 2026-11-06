#!/usr/bin/env node
/**
 * Build data/sources.json from data/cs-source-matrix.yaml.
 *
 * The matrix is the source of truth (comments, legends, coverage); the plugin
 * ships the compact JSON projection so it stays small and lossless.
 *
 * Requires the dev dependency `yaml` (npm install).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'cs-source-matrix.yaml');
const OUT = path.join(ROOT, 'data', 'sources.json');

const doc = YAML.parseDocument(fs.readFileSync(SRC, 'utf8'));
if (doc.errors.length) {
  console.error('YAML errors:', doc.errors.map((e) => e.message).join('; '));
  process.exit(1);
}
const data = doc.toJS({ maxAliasCount: -1 });

const FIELDS = [
  'id', 'name', 'url', 'layer', 'authority', 'evidence', 'kind', 'content_access',
  'license_class', 'cache_policy', 'attribution', 'refresh_days', 'last_checked',
  'keywords', 'ka', 'notes',
];

const sources = data.sources.map((source) => {
  const row = {};
  for (const field of FIELDS) row[field] = source[field];
  row.ka = Array.isArray(source.ka) ? source.ka.slice() : [];
  return row;
});

const out = {
  meta: {
    name: 'CS source registry',
    data_version: 1,
    generated_at: '2026-11-06',
    source_matrix: 'data/cs-source-matrix.yaml',
    count: sources.length,
    knowledge_areas: (data.knowledge_areas || []).map((k) => k.code),
    authority_legend: data.meta.authority_legend,
    evidence_legend: data.meta.evidence_legend,
    content_access_legend: data.meta.content_access_legend,
    license_class_legend: data.meta.license_class_legend,
    cache_policy_legend: data.meta.cache_policy_legend,
    license_note: data.meta.license_note,
  },
  sources,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log(`wrote ${path.relative(ROOT, OUT)}: ${sources.length} sources, ${fs.statSync(OUT).size} bytes`);
