#!/usr/bin/env node
/**
 * SWEEPR DeepBlock — Automated Search-Intent Gap Miner (`scripts/search-intent-gap-miner.mjs`)
 * Delegates to the v2.0 Transactional Keyword Research & Low-Competition Opportunity Engine
 * (`scripts/keyword-research-engine.mjs`) so both `data/keyword-opportunity-matrix.json` and
 * `data/seo-intent-gaps.json` stay 100% synchronized.
 */

import { runKeywordResearchEngine } from './keyword-research-engine.mjs';

runKeywordResearchEngine().catch((err) => {
  console.error('[SEO-INTENT-MINER] Error:', err);
  process.exit(1);
});
