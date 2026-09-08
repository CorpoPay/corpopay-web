#!/usr/bin/env node

/**
 * Thin Lighthouse audit gate.
 *
 * Replaces the retired `@lhci/cli` orchestrator with the maintained `lighthouse`
 * engine directly. It audits a fixed set of *public* routes (unauthenticated) and
 * fails the build when a category score drops below its budget.
 *
 * Usage:
 *   LIGHTHOUSE_BASE_URL=http://localhost:3000 \
 *   LIGHTHOUSE_PATHS=/login,/register \
 *   node scripts/lighthouse-check.mjs
 *
 * Authenticated routes (`/dashboard`, `/pay/:id`) are intentionally NOT audited
 * here — they require a session and are covered by Datadog RUM (100% of pages)
 * and Datadog Synthetics (logged-in journeys) instead.
 */

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE_URL = process.env.LIGHTHOUSE_BASE_URL || "http://localhost:3000";
const PATHS = (process.env.LIGHTHOUSE_PATHS || "/login,/register")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Minimum category scores (0–1). These are blocking: any drop fails CI.
const BUDGETS = {
  accessibility: 0.9,
  "best-practices": 0.8,
  seo: 0.8,
  performance: 0.6,
};

const pct = (n) => Math.round(n * 100);

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-zygote"],
});

const failures = [];

try {
  for (const path of PATHS) {
    const url = new URL(path, BASE_URL).href;
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: Object.keys(BUDGETS),
    });

    const { categories } = result.lhr;
    console.log(`\n${url}`);

    for (const [category, min] of Object.entries(BUDGETS)) {
      const actual = categories[category]?.score ?? 0;
      const passed = actual >= min;
      if (!passed) {
        failures.push({ url, category, min, actual });
      }
      console.log(
        `  ${passed ? "PASS" : "FAIL"}  ${category.padEnd(16)} ${pct(actual)} (min ${pct(min)})`,
      );
    }
  }
} finally {
  await chrome.kill();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} Lighthouse budget failure(s):`);
  for (const f of failures) {
    console.error(`  ${f.url}  ${f.category}: ${pct(f.actual)} < ${pct(f.min)}`);
  }
  process.exit(1);
}

console.log("\nAll Lighthouse budgets passed.");
