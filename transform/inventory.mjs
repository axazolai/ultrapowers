#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { reconcile, assertReasoned } from "./classify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const INVENTORY = join(HERE, "inventory.json");

export function upstreamPaths(repo, ref) {
  const out = execFileSync("git", ["-C", repo, "ls-tree", "-r", "--name-only", ref], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}

function report(r) {
  console.log(`tracked ${r.tracked.length} | ignored ${r.ignored.length} | new ${r.added.length} | removed ${r.removed.length} | unclassified ${r.unclassified.length} | reclassified ${r.reclassified.length}`);
  for (const e of r.added) console.log(`  NEW          ${e.path}  (rule proposes: ${e.proposed})`);
  for (const p of r.unclassified) console.log(`  UNCLASSIFIED ${p}  <- no rule covers this; add one before building`);
  for (const p of r.removed) console.log(`  REMOVED      ${p}  <- upstream no longer ships this`);
  for (const e of r.reclassified) console.log(`  RECLASSIFIED ${e.path}  ${e.was} -> ${e.now}`);
}

function main(argv) {
  const cmd = argv[0] || "check";
  const inventory = JSON.parse(readFileSync(INVENTORY, "utf8"));
  assertReasoned(inventory.rules);
  const ref = argv[1] || inventory.describesTag;
  const paths = upstreamPaths(REPO, ref);
  const r = reconcile({ paths, rules: inventory.rules, manifest: inventory.manifest });
  report(r);

  if (cmd === "sync") {
    if (r.unclassified.length) {
      console.error("refusing to sync: some upstream paths have no rule. Classify them first - the manifest records decisions, it does not invent them.");
      return 1;
    }
    const manifest = {};
    for (const p of [...r.tracked, ...r.ignored].sort()) manifest[p] = r.tracked.includes(p) ? "tracked" : "ignored";
    inventory.manifest = manifest;
    inventory.describesTree = execFileSync("git", ["-C", REPO, "rev-parse", `${ref}^{tree}`], { encoding: "utf8" }).trim();
    writeFileSync(INVENTORY, JSON.stringify(inventory, null, 2) + "\n", "utf8");
    console.log(`synced ${Object.keys(manifest).length} paths -> ${INVENTORY}`);
    return 0;
  }

  const blocking = r.added.length + r.unclassified.length + r.removed.length + r.reclassified.length;
  if (blocking) console.error(`\n${blocking} path(s) need a human decision before this tree can be built.`);
  return blocking ? 1 : 0;
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
