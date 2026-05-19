#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const connectionMapPath = resolve(repoRoot, "projects/mj-mcp/connections/infrastructure-connections.json");
const consoleLanesPath = resolve(repoRoot, "projects/mj-mcp-layer/mcp-layer/src/console-lanes.ts");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractBlock(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`);
  assert(start >= 0, `missing export block: ${exportName}`);
  const nextExport = source.indexOf("\nexport const ", start + 1);
  return source.slice(start, nextExport >= 0 ? nextExport : source.length);
}

function extractLaneIds(block) {
  return [...block.matchAll(/lane:\s*"([^"]+)"/g)].map((match) => match[1]);
}

const connectionMap = readJson(connectionMapPath);
const source = readFileSync(consoleLanesPath, "utf8");
const runtimeLanes = extractLaneIds(extractBlock(source, "CONSOLE_LANES"));
const skippedLanes = extractLaneIds(extractBlock(source, "SKIPPED_CONSOLE_LANES"));
const connectionLanes = connectionMap.lanes.map((lane) => lane.lane);

const runtimeSet = new Set(runtimeLanes);
const skippedSet = new Set(skippedLanes);
const connectionSet = new Set(connectionLanes);

assert(runtimeSet.size === runtimeLanes.length, "CONSOLE_LANES contains duplicate lane ids");
assert(skippedSet.size === skippedLanes.length, "SKIPPED_CONSOLE_LANES contains duplicate lane ids");

for (const lane of runtimeLanes) {
  assert(connectionSet.has(lane), `runtime lane missing from infrastructure connections: ${lane}`);
  assert(!skippedSet.has(lane), `lane cannot be both runtime and skipped: ${lane}`);
}

for (const lane of skippedLanes) {
  assert(connectionSet.has(lane), `skipped lane missing from infrastructure connections: ${lane}`);
}

const expectedRuntimeLanes = connectionLanes.filter((lane) => !skippedSet.has(lane));
const missingRuntime = expectedRuntimeLanes.filter((lane) => !runtimeSet.has(lane));

assert(missingRuntime.length === 0, `infrastructure connection lanes missing from runtime registry: ${missingRuntime.join(", ")}`);

console.log(`[validate-runtime-lanes] ok ${runtimeLanes.length} runtime / ${skippedLanes.length} skipped / ${connectionLanes.length} connections`);
