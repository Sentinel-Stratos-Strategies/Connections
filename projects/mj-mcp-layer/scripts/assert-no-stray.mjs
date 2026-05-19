#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function listFiles() {
  return git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean);
}

function isStray(file) {
  const name = basename(file);
  return (
    file === "untitled" ||
    file.startsWith("untitled/") ||
    file === ".idea" ||
    file.startsWith(".idea/") ||
    file.includes("/.idea/") ||
    file.endsWith(".iml") ||
    name === ".DS_Store" ||
    name === ".env" ||
    name === ".env.local" ||
    file.endsWith(".pem") ||
    file.endsWith(".key") ||
    /(^|\/)artifacts\/.*secret/i.test(file)
  );
}

const offenders = new Set(
  listFiles().filter((file) => existsSync(resolve(repoRoot, file)) && isStray(file)),
);

if (existsSync(resolve(repoRoot, "untitled"))) offenders.add("untitled/");

if (offenders.size > 0) {
  console.error("[no-stray] blocked stray files:");
  for (const offender of [...offenders].sort()) console.error(`  - ${offender}`);
  process.exit(1);
}

console.log("[no-stray] ok");
