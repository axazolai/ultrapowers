import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname } from "node:path";
import { runBuild } from "./build-cli.mjs";

const BUILT = "plugins/ultrapowers/skills/subagent-driven-development/scripts/sdd-workspace";

const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
});

function temp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

// The script is upstream's, reshaped by deltas 007 and 008, so there is no source file to point
// at: what ships is the build's output, and that is what these tests have to exercise.
const SCRIPT = join(temp("sdd-workspace-script-"), "sdd-workspace");
writeFileSync(SCRIPT, runBuild().result.files.get(BUILT).text, "utf8");

const git = (dir, ...args) =>
  execFileSync("git", ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "core.autocrlf=false", ...args], {
    encoding: "utf8",
  }).trim();

// The script ends in `cd "$dir" && pwd`, so it speaks the shell's path dialect, not Node's --
// on Git Bash /tmp/x, not C:\_Temp\x. Every path assertion and file check goes through the
// same shell, or the test measures the dialect instead of the behaviour.
const sh = (cwd, script, ...args) =>
  execFileSync("bash", ["-c", script, "_", ...args], { cwd, encoding: "utf8" }).trim();

const run = (dir, plan) =>
  execFileSync("bash", [SCRIPT, plan], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

function repo() {
  const dir = temp("sdd-workspace-");
  git(dir, "init", "-q", "-b", "main");
  return { dir, root: sh(dir, "pwd -P") };
}

function plan(dir, relative) {
  const full = join(dir, relative);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, "# Plan\n\n## Task 1: thing\n");
  return relative.split("\\").join("/");
}

test("plans sharing a basename across kinds resolve to different workspaces", () => {
  const { dir } = repo();
  const phase = plan(dir, ".ultrapowers/phases/01-a/01-PLAN.md");
  const task = plan(dir, ".ultrapowers/tasks/01-b/01-PLAN.md");
  const a = run(dir, phase);
  const b = run(dir, task);
  assert.notEqual(a, b, "a first phase and a first task shared one workspace");
  assert.equal(basename(a), "phases-01-a");
  assert.equal(basename(b), "tasks-01-b");
});

test("a plan outside the tree falls back to its basename", () => {
  const { dir, root } = repo();
  const legacy = plan(dir, "docs/2026-07-28-feature.md");
  assert.equal(run(dir, legacy), `${root}/.ultrapowers/sdd/plan-2026-07-28-feature`);
});

test("a fallback basename shaped like a tree slug cannot claim that tree plan's workspace", () => {
  const { dir } = repo();
  const real = run(dir, plan(dir, ".ultrapowers/phases/01-a/01-PLAN.md"));
  const lookalike = run(dir, plan(dir, "docs/phases-01-a.md"));
  assert.notEqual(lookalike, real);
  assert.equal(basename(real), "phases-01-a");
  assert.equal(basename(lookalike), "plan-phases-01-a");
});

test("only the working tree's own .ultrapowers, and only its three kinds, name a tree plan", () => {
  const { dir } = repo();
  const real = run(dir, plan(dir, ".ultrapowers/phases/01-a/01-PLAN.md"));
  const nested = run(dir, plan(dir, "sub/.ultrapowers/phases/01-a/01-PLAN.md"));
  const strayKind = run(dir, plan(dir, ".ultrapowers/plan/02-a/02-PLAN.md"));
  assert.notEqual(nested, real, "a nested .ultrapowers aliased the working tree's own");
  assert.notEqual(strayKind, real);
  assert.equal(basename(nested), "plan-01-PLAN");
  assert.equal(basename(strayKind), "plan-02-PLAN");
});

test("a workspace refuses a second plan rather than sharing itself", () => {
  const { dir } = repo();
  const first = plan(dir, "sub/.ultrapowers/phases/01-a/01-PLAN.md");
  const second = plan(dir, "pkg/.ultrapowers/phases/01-z/01-PLAN.md");
  run(dir, first);
  // Both reduce to plan-01-PLAN: no flat slug is injective over paths, so the guarantee has to
  // come from the workspace knowing whose it is.
  assert.throws(
    () => run(dir, second),
    (e) => e.status === 2 && String(e.stderr).includes(first) && String(e.stderr).includes(second),
  );
});

test("re-resolving the same plan is idempotent, from the main checkout or a worktree", () => {
  const { dir } = repo();
  const planPath = plan(dir, ".ultrapowers/phases/01-a/01-PLAN.md");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "plan");
  const wt = join(temp("sdd-workspace-wt-"), "wt");
  git(dir, "worktree", "add", "-q", wt, "-b", "feature");
  // The owner is recorded relative to the working tree, or resolving from the worktree would
  // read as a second claimant on the workspace the main checkout just created.
  assert.equal(run(wt, planPath), run(dir, planPath));
  assert.equal(run(dir, planPath), run(dir, planPath));
});

test("the workspace self-ignores, so it never reaches git status", () => {
  const { dir } = repo();
  const workspace = run(dir, plan(dir, ".ultrapowers/phases/01-a/01-PLAN.md"));
  sh(dir, 'printf "# ledger\\n" > "$1/progress.md"', workspace);
  assert.doesNotMatch(git(dir, "status", "--porcelain"), /sdd/);
});
test("a linked worktree resolves the main repository's workspace, which outlives it", () => {
  const { dir, root } = repo();
  const planPath = plan(dir, ".ultrapowers/phases/01-hooks/01-PLAN.md");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "plan");

  const wt = join(temp("sdd-workspace-wt-"), "wt");
  git(dir, "worktree", "add", "-q", wt, "-b", "feature");

  const workspace = run(wt, planPath);
  sh(dir, 'printf "# ledger\\n" > "$1/progress.md"', workspace);
  // No --force: the workspace self-ignores, so git reads the worktree as clean either way, which
  // is why a workspace living inside it used to be removed here without a word.
  git(dir, "worktree", "remove", wt);
  assert.equal(sh(dir, '[ -f "$1/progress.md" ] && echo kept || echo lost', workspace), "kept");
  assert.equal(workspace, `${root}/.ultrapowers/sdd/phases-01-hooks`);
});
