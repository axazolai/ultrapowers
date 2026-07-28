import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "fork-owned", "phase-dir");

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "phase-dir-"));
  execFileSync("git", ["-C", dir, "init", "-q"]);
  return dir;
}
const run = (dir, ...args) =>
  execFileSync("bash", [SCRIPT, ...args], { cwd: dir, encoding: "utf8" }).trim();

test("allocates 01 for the first phase", () => {
  const dir = repo();
  assert.equal(basename(run(dir, "phase", "planning-tree")), "01-planning-tree");
});

test("allocates the next free number per kind", () => {
  const dir = repo();
  run(dir, "phase", "first");
  assert.equal(basename(run(dir, "phase", "second")), "02-second");
  assert.equal(basename(run(dir, "task", "quick")), "01-quick");
});

test("re-resolves an existing slug instead of allocating again", () => {
  const dir = repo();
  const first = run(dir, "phase", "planning-tree");
  run(dir, "phase", "other");
  assert.equal(run(dir, "phase", "planning-tree"), first);
});

test("counts gaps from the highest number, never reusing a deleted one", () => {
  const dir = repo();
  mkdirSync(join(dir, ".ultrapowers", "phases", "07-old"), { recursive: true });
  assert.equal(basename(run(dir, "phase", "new")), "08-new");
});

test("rejects an unknown kind and a slug containing a separator", () => {
  const dir = repo();
  assert.throws(() => run(dir, "milestone", "x"));
  assert.throws(() => run(dir, "phase", "a/b"));
});

const RACERS = 12;

const runParallel = (dir, slugs) =>
  Promise.all(
    slugs.map(
      (slug) =>
        new Promise((resolve, reject) => {
          const child = spawn("bash", [SCRIPT, "phase", slug], { cwd: dir });
          let out = "";
          let err = "";
          child.stdout.on("data", (c) => (out += c));
          child.stderr.on("data", (c) => (err += c));
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0 ? resolve(out.trim()) : reject(new Error(`exit ${code}: ${err.trim()}`)),
          );
        }),
    ),
  );

const allocated = (dir) =>
  readdirSync(join(dir, ".ultrapowers", "phases"))
    .filter((d) => /^[0-9][0-9]-/.test(d))
    .sort();

test("parallel allocations for different slugs never share a number", async () => {
  const dir = repo();
  const slugs = Array.from({ length: RACERS }, (_, i) => `slug-${i}`);
  const printed = await runParallel(dir, slugs);
  const dirs = allocated(dir);
  assert.deepEqual(printed.map((p) => basename(p)).sort(), dirs);
  assert.equal(dirs.length, RACERS, `expected ${RACERS} directories, got ${dirs}`);
  const prefixes = dirs.map((d) => d.slice(0, 2));
  assert.equal(new Set(prefixes).size, RACERS, `numbers shared between directories: ${dirs}`);
});

test("parallel allocations for one slug all resolve to a single directory", async () => {
  for (let round = 0; round < 12; round++) {
    const dir = repo();
    const printed = await runParallel(
      dir,
      Array.from({ length: RACERS }, () => "shared"),
    );
    assert.deepEqual(allocated(dir), ["01-shared"], `round ${round} allocated twice`);
    assert.equal(new Set(printed).size, 1, `round ${round} printed ${[...new Set(printed)]}`);
  }
});
