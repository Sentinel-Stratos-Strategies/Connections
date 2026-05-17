#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const meshRoot = resolve(repoRoot, "projects/mj-mcp");
const lanesRoot = resolve(meshRoot, "lanes");
const connectionsPath = resolve(meshRoot, "connections/infrastructure-connections.json");

const requiredConsoleLanes = new Set([
  "mj-browser",
  "mj-build-ios",
  "mj-build-macos",
  "mj-build-web",
  "mj-circleci",
  "mj-cloudflare",
  "mj-codex",
  "mj-codex-security",
  "mj-figma",
  "mj-github",
  "mj-gmail",
  "mj-linear",
  "mj-network-solutions",
  "mj-notion",
  "mj-openai",
  "mj-scite",
  "mj-superpowers",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function laneManifestPaths() {
  return readdirSync(lanesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(lanesRoot, entry.name, "lane.manifest.json"))
    .sort();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const connectionMap = readJson(connectionsPath);
assert(connectionMap.version === 1, "infrastructure connection map must be version 1");
assert(connectionMap.authority?.worker === "mj-edge", "authority worker must be mj-edge");
assert(Array.isArray(connectionMap.lanes), "connection map lanes must be an array");

const connectionsByLane = new Map(connectionMap.lanes.map((lane) => [lane.lane, lane]));
assert(connectionsByLane.size === connectionMap.lanes.length, "connection map contains duplicate lane ids");

const manifests = laneManifestPaths().map((path) => ({ path, manifest: readJson(path) }));
const manifestsByLane = new Map(manifests.map((entry) => [entry.manifest.lane, entry]));
assert(manifestsByLane.size === manifests.length, "lane manifests contain duplicate lane ids");

for (const lane of requiredConsoleLanes) {
  assert(connectionsByLane.has(lane), `required console lane missing from infrastructure connections: ${lane}`);
  assert(manifestsByLane.has(lane), `required console lane missing manifest: ${lane}`);
}

for (const [lane, entry] of manifestsByLane) {
  assert(connectionsByLane.has(lane), `manifest lane missing from infrastructure connections: ${lane}`);
  assert(entry.manifest.requiresAudit === true, `lane must require audit: ${lane}`);
  assert(entry.manifest.dataBoundaries?.secretHandling === "never_return_secret_values", `lane must never return secret values: ${lane}`);
}

for (const [lane, connection] of connectionsByLane) {
  assert(manifestsByLane.has(lane), `connection lane missing manifest: ${lane}`);
  assert(connection.entrypoint, `connection lane missing entrypoint: ${lane}`);
  assert(Array.isArray(connection.requiredHeaders), `connection lane missing required headers: ${lane}`);
  assert(connection.requiredHeaders.includes("x-operator-capability"), `connection lane missing capability header: ${lane}`);
  assert(connection.auditMode === "required", `connection lane must require audit: ${lane}`);
}

console.log(`[validate-mini-lanes] ok ${manifests.length} manifests / ${connectionMap.lanes.length} connections`);
