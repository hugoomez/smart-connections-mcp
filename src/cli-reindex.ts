#!/usr/bin/env node
/**
 * Direct-invocation reindex CLI — no MCP protocol round-trip.
 *
 * Calls the exact same reindex() function the "reindex" MCP tool calls
 * (see tools.ts handleReindex / indexer.ts reindex). Exists so a hook can
 * trigger a reindex as a plain command-type PostToolUse hook instead of an
 * mcp_tool-type one, since mcp_tool hooks have not been observed to
 * complete in any tested session type, while command-type hooks have
 * worked reliably in every one tried.
 *
 * Usage: node dist/cli-reindex.js --path Papers/ [--vault /path/to/vault]
 * Vault path falls back to VAULT_PATH env var, matching index.ts.
 */

import { validateConfig, Config } from './security.js';
import { loadSmartConnectionsData, SmartConnectionsData } from './data.js';
import { createEmbedder, Embedder } from './embeddings.js';
import { reindex } from './indexer.js';

function parseArgs(): { vaultPath: string | undefined; pathPrefix: string | undefined } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  return {
    vaultPath: get('--vault') ?? process.env.VAULT_PATH,
    pathPrefix: get('--path'),
  };
}

async function main(): Promise<void> {
  const { vaultPath, pathPrefix } = parseArgs();

  let config: Config;
  try {
    config = validateConfig(vaultPath);
  } catch (e) {
    console.error(JSON.stringify({ error: `config: ${String(e)}` }));
    process.exit(1);
  }

  let data: SmartConnectionsData;
  try {
    data = loadSmartConnectionsData(config);
  } catch (e) {
    console.error(JSON.stringify({ error: `data load: ${String(e)}` }));
    process.exit(1);
  }

  let embedder: Embedder;
  try {
    embedder = await createEmbedder(data.modelInfo.modelKey, data.modelInfo.dimensions);
  } catch (e) {
    console.error(JSON.stringify({ error: `embedder init: ${String(e)}` }));
    process.exit(1);
  }

  const result = await reindex(config, data, embedder, pathPrefix);
  console.log(JSON.stringify(result));
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(JSON.stringify({ error: `fatal: ${String(e)}` }));
  process.exit(1);
});
