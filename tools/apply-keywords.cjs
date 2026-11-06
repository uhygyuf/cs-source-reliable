#!/usr/bin/env node
/**
 * Merge tools/source-keywords.json into data/cs-source-matrix.yaml as a
 * `keywords` field on every source (comment-preserving edit).
 *
 * Requires the dev dependency `yaml` (npm install).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const ROOT = path.join(__dirname, '..');
const MATRIX = path.join(ROOT, 'data', 'cs-source-matrix.yaml');
const KEYWORDS = path.join(__dirname, 'source-keywords.json');

const mapping = JSON.parse(fs.readFileSync(KEYWORDS, 'utf8'));
const doc = YAML.parseDocument(fs.readFileSync(MATRIX, 'utf8'));
if (doc.errors.length) {
  console.error('YAML errors:', doc.errors.map((e) => e.message).join('; '));
  process.exit(1);
}
const seq = doc.get('sources');
const sources = doc.toJS({ maxAliasCount: -1 }).sources;
const missing = [];
const extra = new Set(Object.keys(mapping));
for (let i = 0; i < sources.length; i++) {
  const id = sources[i].id;
  const words = mapping[id];
  if (!Array.isArray(words) || words.length === 0) { missing.push(id); continue; }
  extra.delete(id);
  seq.items[i].set('keywords', doc.createNode(words));
}
if (missing.length) { console.error('missing keywords for:', missing.join(', ')); process.exit(1); }
if (extra.size) { console.error('keywords for unknown ids:', [...extra].join(', ')); process.exit(1); }

fs.writeFileSync(MATRIX, doc.toString({ lineWidth: 0 }), 'utf8');
console.log(`updated ${path.relative(ROOT, MATRIX)}: ${sources.length} sources with keywords`);
