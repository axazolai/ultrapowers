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

const run = (dir, plan) => execFileSync("bash", [SCRIPT, plan], { cwd: dir, encoding: "utf8" }).trim();

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
  assert.equal(run(dir, legacy), `${root}/.ultrapowers/sdd/2026-07-28-feature`);
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
