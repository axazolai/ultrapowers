import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
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
