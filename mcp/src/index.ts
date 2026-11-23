#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Database } from "../../src/lib/database.types";
import { createServer, SERVER_VERSION } from "./server";
import { missingEnv, SupabaseRecapwellData } from "./supabase-data";

// stdout carries the MCP protocol — log ONLY to stderr.
const log = (...args: unknown[]) => console.error("[recapwell-mcp]", ...args);

// Optional mcp/.env (next to dist/ and src/) for setups that can't pass env vars.
const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

let url: string, key: string, email: string, password: string;
try {
  url = process.env.RECAPWELL_SUPABASE_URL ?? "http://127.0.0.1:54321";
  key = process.env.RECAPWELL_SUPABASE_KEY || missingEnv("RECAPWELL_SUPABASE_KEY");
  email = process.env.RECAPWELL_EMAIL || missingEnv("RECAPWELL_EMAIL");
  password = process.env.RECAPWELL_PASSWORD || missingEnv("RECAPWELL_PASSWORD");
} catch (err) {
  log((err as Error).message);
  process.exit(1);
}

const client = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: true },
});

const server = createServer(new SupabaseRecapwellData(client, { email, password }));
await server.connect(new StdioServerTransport());
log(`v${SERVER_VERSION} running on stdio — Supabase ${url}, user ${email}`);
