/**
 * Vendors the generated OpenAPI contract from the CorpoPay API repo into
 * ./contract.
 *
 * The API repo (`CorpoPay/corpopay-api`) is the single source of truth; its
 * `contract:generate` produces `contract/{api-types.d.ts,openapi.json,enums.ts}`.
 * This script fetches those files so the web stays in sync without needing the
 * API repo checked out as a sibling directory.
 *
 * Override the source via CONTRACT_BASE_URL (defaults to the API repo's `main`
 * branch on GitHub). Point it at a private mirror or a local server during
 * development if needed.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE =
  process.env.CONTRACT_BASE_URL ??
  "https://raw.githubusercontent.com/CorpoPay/corpopay-api/main";

const FILES = ["api-types.d.ts", "openapi.json", "enums.ts"];
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../contract");

for (const file of FILES) {
  const res = await fetch(`${BASE}/contract/${file}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${file}: HTTP ${res.status} from ${BASE}/contract/${file}`);
  }
  await writeFile(path.join(outDir, file), await res.text());
  console.log(`✓ ${file}`);
}

console.log(`Contract vendored from ${BASE}`);
