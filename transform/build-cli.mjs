#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "./build.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const git = (args, opts = {}) => execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opts });

export function readOriginal(ref) {
  const tree = new Map();
  for (const line of git(["ls-tree", "-r", ref]).split("\n").filter(Boolean)) {
    const [meta, path] = line.split("\t");
    const [mode, , sha] = meta.split(/\s+/);
    const buf = git(["cat-file", "-p", sha], { encoding: "buffer" });
    tree.set(path, { mode, text: buf.toString("utf8") });
  }
  return tree;
}

function readForkOwned(inventory) {
  const m = new Map();
  for (const f of inventory.forkOwned ?? []) {
    const p = join(HERE, f.src);
    if (existsSync(p)) m.set(f.src, readFileSync(p, "utf8"));
  }
  return m;
}

function readDeltas() {
  const dir = join(HERE, "deltas");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".patch")).sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
}

export function runBuild({ withDeltas = true } = {}) {
  const cfg = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
  const inventory = JSON.parse(readFileSync(join(HERE, "inventory.json"), "utf8"));
  const tree = readOriginal(cfg.originalTag);
  const actualTree = git(["rev-parse", `${cfg.originalTag}^{tree}`]).trim();
  if (actualTree !== cfg.originalTree) {
    throw new Error(`the recorded base moved: config says ${cfg.originalTree}, ${cfg.originalTag} is ${actualTree}`);
  }
  return { result: build({ tree, cfg, inventory, forkOwned: readForkOwned(inventory), deltas: withDeltas ? readDeltas() : [] }), cfg, inventory };
}

export function refusals(result, cfg) {
  const out = [];
  const d = result.mapDrift;
  if (cfg.thresholds?.unclassifiedRefuses && d.unclassified.length) out.push(`${d.unclassified.length} upstream path(s) no rule covers: ${d.unclassified.join(", ")}`);
  if (d.added.length) out.push(`${d.added.length} upstream path(s) absent from the manifest: ${d.added.map((a) => a.path).join(", ")}`);
  if (d.removed.length) out.push(`${d.removed.length} manifest path(s) upstream no longer ships: ${d.removed.join(", ")}`);
  for (const f of result.failures) out.push(`delta did not apply: ${f.name} - ${f.detail}`);
  if (cfg.thresholds?.attributionMissingRefuses) for (const a of result.attributionMissing) out.push(`attribution: ${a.detail} (${a.reason})`);
  if (result.residual.length) {
    const shown = [...new Set(result.residual.map((r) => `${r.path}: ${r.text}`))].slice(0, 10);
    out.push(`${result.residual.length} upstream-name occurrence(s) survived outside the protected slug:\n    ${shown.join("\n    ")}`);
  }
  return out;
}

function emit(files, dir) {
  rmSync(dir, { recursive: true, force: true });
  for (const [path, entry] of files) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, entry.text, "utf8");
  }
}

function writeTree(files) {
  const index = join(tmpdir(), `up-build-index-${process.pid}`);
  rmSync(index, { force: true });
  const lines = [];
  for (const [path, entry] of files) {
    const sha = execFileSync("git", ["-C", REPO, "hash-object", "-w", "--stdin"], { input: Buffer.from(entry.text, "utf8"), encoding: "utf8" }).trim();
    lines.push(`${entry.mode} ${sha}\t${path}`);
  }
  execFileSync("git", ["-C", REPO, "update-index", "--index-info"], { input: lines.join("\n") + "\n", env: { ...process.env, GIT_INDEX_FILE: index } });
  const tree = execFileSync("git", ["-C", REPO, "write-tree"], { encoding: "utf8", env: { ...process.env, GIT_INDEX_FILE: index } }).trim();
  rmSync(index, { force: true });
  return tree;
}

function report(result, cfg) {
  console.log(`files ${result.files.size} | deltas applied ${result.applied.length} obsolete ${result.obsolete.length} failed ${result.failed.length}`);
  for (const n of result.obsolete) console.log(`  OBSOLETE  ${n}  <- upstream has since done this itself; decide whether to drop it, do not drop it automatically`);
  const problems = refusals(result, cfg);
  for (const p of problems) console.error(`  REFUSE    ${p}`);
  return problems.length;
}

function safeGit(args) {
  try { return git(args).trim(); } catch { return null; }
}

function main(argv) {
  const cmd = argv[0] || "check";
  const base = argv.includes("--base");   // emit the pre-delta tree: what a delta must be authored against
  const { result, cfg, inventory } = runBuild({ withDeltas: !base });
  // `facts` writes JSON to stdout; a human report on the same stream would corrupt it.
  const problems = cmd === "facts" ? refusals(result, cfg).length : report(result, cfg);

  if (cmd === "emit") {
    const dir = argv[1] || join(REPO, ".build");
    emit(result.files, dir);
    console.log(`emitted ${result.files.size} files -> ${dir}`);
    return 0;
  }
  if (cmd === "tree") {
    console.log(writeTree(result.files));
    return problems ? 1 : 0;
  }
  if (cmd === "facts") {
    // The machine-readable contract /up-update assesses. Kept here rather than reimplemented there:
    // the fork owns how it is built, and two implementations of that would drift.
    const built = writeTree(result.files);
    const mainTree = safeGit(["rev-parse", "main^{tree}"]);
    const mainDrift = mainTree && mainTree !== built
      ? git(["diff", "--name-only", mainTree, built]).split("\n").filter(Boolean)
      : [];
    process.stdout.write(JSON.stringify({
      originalTag: cfg.originalTag,
      originalTree: cfg.originalTree,
      pluginRoot: inventory.pluginRoot,
      version: result.version,
      files: result.files.size,
      treeHash: built,
      mainTree,
      mainDrift,
      applied: result.applied,
      obsolete: result.obsolete,
      failed: result.failed,
      failures: result.failures,
      attributionMissing: result.attributionMissing,
      residual: result.residual,
      mapDrift: result.mapDrift,
      thresholds: cfg.thresholds,
    }, null, 2) + "\n");
    return 0;
  }
  if (cmd === "drift") {
    const built = writeTree(result.files);
    const head = git(["rev-parse", "main^{tree}"]).trim();
    if (built === head) { console.log(`main is exactly what original + patch produce (tree ${built})`); return problems ? 1 : 0; }
    const diff = git(["diff", "--name-status", head, built]).trim();
    console.error(`main does not match a fresh build (branch ${head}, built ${built}):\n${diff}`);
    console.error("main is generated. A change here that is not derivable from original + patch is a defect, not an edit.");
    return 1;
  }
  if (cmd === "commit") {
    if (problems) { console.error("refusing to commit"); return 1; }
    const tree = writeTree(result.files);
    const head = git(["rev-parse", "main"]).trim();
    const patchSha = git(["rev-parse", "HEAD"]).trim();
    const message = `build: ${inventory.pluginRoot} from ${cfg.originalTag}\n\n`
      + `original  ${cfg.originalTag} (tree ${cfg.originalTree})\n`
      + `patch     ${patchSha}\n`
      + `tree      ${tree}\n`
      + `deltas    applied ${result.applied.join(", ") || "-"} | obsolete ${result.obsolete.join(", ") || "-"}\n\n`
      + "Generated by transform/build-cli.mjs. This branch is never hand-edited: a change here that\n"
      + "is not derivable from original + patch is a defect the next build detects.";
    const commit = execFileSync("git", ["-C", REPO, "commit-tree", tree, "-p", head], { input: message, encoding: "utf8" }).trim();
    git(["update-ref", "refs/heads/main", commit]);
    console.log(`main -> ${commit} (tree ${tree})`);
    return 0;
  }
  return problems ? 1 : 0;
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
