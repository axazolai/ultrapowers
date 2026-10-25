# Ultrapowers

A skills library for Claude Code: test-driven development, systematic debugging, planning,
code review and the collaboration patterns that hold them together. Skills load on demand and
announce themselves, so you can see which one is driving.

🇬🇧 English | [🇷🇺 Русский](README.ru.md)

## Attribution

Ultrapowers is a **fork of [obra/superpowers](https://github.com/obra/superpowers)** by Jesse
Vincent, used and redistributed under the **MIT** licence. The copyright notice in `LICENSE` is
upstream's, unchanged, and it stays that way in every build.

This fork exists to be one thing well rather than seven things adequately: it targets Claude Code
only. That is a narrowing, not an improvement — if you use Codex, Cursor, Gemini, Kimi, opencode
or Pi, install upstream instead, which supports all of them and is maintained by the people who
wrote these skills.

## Install

```
/plugin marketplace add axazolai/ultrapowers
/plugin install ultrapowers@ultrapowers
```

Then restart: the enabled-plugin set is resolved at startup and does not hot-reload.

## How it differs from upstream

Built from **upstream 6.4.1**; the plugin reports its version as `<upstream>-up.<revision>`, so
this build is `6.4.1-up.1`. The revision grows with fork changes on one upstream base and resets
to 1 on a new base. Everything not listed below is upstream's work, carried across unchanged.

### Scope and identity

- **Claude Code only.** The other harnesses' plugin manifests, adapters and per-harness skill
  references are not carried across, and neither is upstream's own test suite, release tooling or
  development history. 72 of upstream's 231 files ship: the manifest, the `SessionStart` hook, the
  skills, and `LICENSE`. `using-ultrapowers` keeps one platform reference — Claude Code's, which
  carries the opt-in cheaper orchestration for subagent-driven development — and the
  brainstorming server reads its version from `.claude-plugin/plugin.json` alone.
- **Renamed throughout**, so both can be installed side by side and a skill invocation is
  unambiguous: `ultrapowers:brainstorming` resolves here, and upstream's skills keep their own
  namespace rather than colliding with these.
- **The manifest and the brand link point at this fork** — homepage, repository, author — while
  the description names upstream, so `/plugin` shows where the plugin came from without anyone
  opening the README.

### Testing mode: tdd or test-after

Every project has a testing mode, stored as `"tdd"` in `.claude/ultrapowers.json` (no file means
test-after). The claude-config bundle switches it with `/ultrapowers-tdd enable|disable`; without
the bundle, set the key by hand:

- **tdd** — upstream's test-driven development: failing test first, RED → GREEN → REFACTOR, TDD
  evidence in task reports, RED → GREEN fixes after the final review.
- **test-after** — code first; when a unit of work stands whole, and before its review, the
  plan carries the decisions made along the way as `Ruling:` lines, and one test per stated
  behaviour is written and checked by mutation. Plans carry an `Acceptance:` list instead of
  test code.

In both modes: a bug found during the work is fixed in the work, before the unit's review —
nothing is logged for later; a decision that changes behaviour goes into the plan first; a
plan's Review Focus lines join the owning task's test list; the reviewer's findings about
behaviour the plan is silent on go to the partner, who puts each into the plan or rejects it;
every failure a run shows is reported by name.

### Planning lives in a tree, not in dated files

Upstream writes designs to `docs/ultrapowers/specs/YYYY-MM-DD-<topic>-design.md` and plans to
`docs/ultrapowers/plans/YYYY-MM-DD-<feature>.md`. Here a phase has one document:

- `bash scripts/phase-dir phase|task|adhoc <slug>` resolves and prints
  `.ultrapowers/phases/NN-<slug>/`, allocating a number above the highest existing one and never
  reusing it. Re-running with the same slug re-resolves the same directory, so brainstorming,
  `writing-plans`, `subagent-driven-development` and `executing-plans` cannot drift to different
  places for one phase.
- `NN-PLAN.md` in that directory is the phase: brainstorming writes the design as its header
  (Goal, Branch, Constraints, Out of scope, Design, the behaviours the tests will confirm);
  `writing-plans` appends the tasks below. There is no separate spec file — where a skill says
  "the spec", it means the plan's header.
- The plan is the phase's state. An executor ticks a task's `- [ ]` box as it completes, writes a
  deviation under the task as a one-line `Ruling:`, marks a dropped task `- [-]`, and closes the
  plan with a `Result:` line per stage (commit range, suite count, review verdict) plus the
  phase's row in `.ultrapowers/ROADMAP.md`. No summary, verification or state file is written.
- The workspace is deleted file by name at the end — never recursively.

### Brainstorming

- **Stack drift is checked once, at design time** — `node ~/.claude/hooks/lib/stack-rules-check.mjs
  <root>`, reported only when it says `stale`.
- **The design lists the behaviours the tests will confirm**, one line each; in test-after mode
  the tests confirm exactly these.

### Planning checks that execute

Upstream's plan self-review checks are read with fresh eyes. Here checks 6 and 7 are *run*: every
command the plan tells an implementer to run is run first, in the worktree they will use, and
every invariant stated in a task's Interfaces block is executed against that task's own sample
code.

### Code review

A **structural pre-pass** runs before the checks: `fallow` over the changed files, folded into
the Issues section at the severity it reports. In a GSD project (`.planning/` exists) it is
skipped; with no `fallow` binary in a JavaScript project it degrades to one Minor note naming the
install command, and elsewhere it is skipped silently.

### Diagnosing a session

`diagnosing-ultrapowers` keeps its workspace in the project's scratchpad
(`.claude/.scratchpad/diagnosing/<session-id>/`), has no GitHub-issue step, and runs its seven
parallel analysts only with the partner's permission.

### The deltas, for completeness

Each change above is one numbered patch on the `patch` branch, applied at build time:

| delta | what it changes |
|---|---|
| `001-fallow-graft` | the structural pre-pass in code review |
| `002-drop-platform-adaptation` | `using-ultrapowers` keeps only the Claude Code reference |
| `003-plugin-version-source` | the brainstorming server reads the Claude Code manifest only |
| `004-plugin-manifest` | fork identity in `plugin.json`, upstream credited in the description |
| `005-brand-link` | the brainstorming UI's brand link points at this fork |
| `007-planning-tree` | one document per phase: the design as the header of `NN-PLAN.md` in the phase directory, no spec file |
| `009-plan-is-the-state` | ticked boxes, `Ruling:` and `Result:` lines in the plan, the ROADMAP row; the workspace deleted by name |
| `010-stack-drift-check` | stack drift checked once, at design time |
| `011-planning-rules-are-run` | plan checks 6 and 7 execute instead of being read |
| `014-test-after-coverage` | the testing mode (tdd / test-after), bugs fixed in the work, out-of-spec findings to the partner |
| `015-diagnosing-in-project` | diagnosing in the project scratchpad, no GitHub issues, analysts on permission |
| `016-model-policy-pointer` | Model Selection defers to an environment's model-selection policy |

One file is the fork's own rather than a patch on upstream's:
`skills/brainstorming/scripts/phase-dir`.

## How it is built

The plugin is generated, never hand-edited. Three branches:

| branch | holds |
|---|---|
| `original` | pristine upstream snapshots — one commit per release, tagged `upstream/<version>` |
| `patch` | the plugin map, the rename transform, and our changes as discrete numbered deltas |
| `main` | the generated result: `original` + `patch`, installable |

A rebuild that does not reproduce `main` byte-for-byte is a defect the build reports. See the
repository README for the update procedure.

## Licence

MIT, Copyright (c) 2025 Jesse Vincent. See `LICENSE`.
