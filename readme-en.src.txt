# cs-source-reliable

English · [简体中文](README.zh.md)

Source reliability for CS teaching in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a bundled registry of **119 verified, agent-collectable CS sources** with authority/evidence tiers, plus two model-facing tools to find sources and audit citations.

A plugin for DeepSeek Harness (`dsh`). The registry covers the 17 [CS2023](https://csed.acm.org/) knowledge areas and ships as data; both tools are local lookups (no network calls), so they are fast and have no side effects.

## What it ships

- **119 sources** — 68 teaching-layer (textbooks, courses, official docs, standards) and 51 frontier-layer (preprints, proceedings, release notes, advisories).
- Per source: authority tier (`A` primary spec/official docs/releases, `B` peer-reviewed/authoritative, `C` curated secondary, `D` lead only), evidence type, `content_access` (static / portal / js / redirect / frameset / api / binary), `license_class`, `cache_policy`, `attribution`, `refresh_days`, `last_checked`, and the CS2023 areas it serves.
- **Two tools**: `cs_source_find` and `cs_source_audit`.
- A short system-prompt section that tells the model when to use them and how to cite.

## Tools

### `cs_source_find`

Find a source by URL, keyword, or CS2023 area code.

- `url` — match a page (host + path prefix).
- `query` — keywords, e.g. `"algorithm textbook"` or `"RFC"`.
- `ka` — one of `AL AR CN DM DS FPL GV HCI IS MSF OS PDC SEC SE SEP SF SPD`.
- `layer` — `breadth` (teaching) or `depth` (frontier).
- `limit` — max results (default 5, ceiling 20).

Returns the compact record with tier, access mode and refresh policy. Example result:

```
- [python-docs] Python Documentation — A/official-doc; access=static; refresh=30d; https://docs.python.org/3/
```

Keyword ranking uses IDF-like token weighting with a subject-token boost, so `"python 3.13 release notes"` ranks Python sources above generic "release notes" pages.

### `cs_source_audit`

Audit the URL citations in a draft answer: map each URL to a known source, report its tier and access mode, flag unknown domains and C/D-tier citations, count substantive paragraphs without a source, and suggest fixes.

```
Citations: 2/2 audited, 1 known, 1 unknown; A=1 B=0 C=0 D=0; uncited paragraphs=0
- https://docs.python.org/3/ -> python-docs (A/official-doc)
- https://example.com/blog/post -> unknown; not in the registry: verify the domain yourself before relying on it
```

## Trigger rules

The plugin does not intercept requests. The model decides, guided by a system-prompt section (order 240, in the plugin-guidance band):

- call `cs_source_find` before stating CS facts that depend on versions, APIs, standards, or current state;
- prefer A/B sources, treat C as secondary and D as a lead, never as fact;
- cite as `[source-id] URL` plus the version or date the source states, and say "unsourced" when no registry source fits;
- call `cs_source_audit` on a draft that cites URLs before sending it;
- skip both tools for non-CS topics.

## Measured footprint (2026-11-06)

| Item | Measured |
|---|---|
| `cs_source_find` schema (name + description + parameters) | 893 chars ≈ 224 tokens |
| `cs_source_audit` schema | 454 chars ≈ 114 tokens |
| Guidance section | 642 chars ≈ 161 tokens |
| **Combined per-request overhead** | **≈ 498 tokens** (schemas + guidance) |
| Registry load | 0.7–2.6 ms |
| `cs_source_find` latency | avg 0.081 ms, p95 0.15 ms (5,000 calls) |
| `cs_source_audit` latency | avg 0.022 ms (3,064-char draft, 500 calls) |

Token counts are character-based estimates at 4 chars/token; the two tool schemas and the guidance are prompt-cached along with the rest of the system prompt. Tool output is bounded (≤20 results, notes truncated to 180 chars).

## Install

Requirements: DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`, Node.js 20+.

From a GitHub checkout:

```sh
dsh plugin --profile web add github:<owner>/cs-source-reliable
```

From a local directory during development:

```sh
dsh plugin --profile web add /absolute/path/to/cs-source-reliable
```

Restart or reload the profile after installing. The plugin row appears under Settings → Plugins as **CS source reliability**.

## Development

```sh
node test/check.mjs     # 26 checks: registry, tools, lossless JSON, latency budgets
```

The registry is generated from `cs-source-matrix.yaml` by `node tools/build-plugin-data.cjs`; the bundled file is `data/sources.json`.

## Data provenance and maintenance

- Every source was probed on 2026-11-06: 118/119 returned HTTP 200; Semantic Scholar returned 429 (it needs an API key).
- `refresh_days` is a suggestion per source class: advisories 2 d, feeds/releases 7 d, official docs 30 d, peer-reviewed 90 d, specs 180 d, textbooks 365 d. `last_checked` is the probe date.
- `license_class` / `cache_policy` are policy buckets, not legal advice: link to the source and quote briefly; full-text caching is only allowed for public-domain/open sources.

## Limitations

- The tools **look up a curated registry**; they do not fetch pages or verify claims on their own. Source-tier data is only as fresh as the last registry rebuild.
- `cs_source_audit` is a mechanical check (URL extraction, tier mapping, uncited-paragraph count). It does not judge whether a cited source actually supports a sentence.
- A/B tiers reduce risk; they do not guarantee correctness. Version-sensitive claims still need the version/date the source states.
- Non-registry URLs are flagged as unknown even when legitimate (e.g. a project's own GitHub repository is not a CS knowledge source).

## License

MIT. The registry contains only source names, URLs and policy metadata; the referenced content remains under each source's own terms.
