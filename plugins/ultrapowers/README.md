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

Every project has a testing mode, set with `/ultrapowers-tdd enable|disable` (stored in
`.claude/ultrapowers.json`; no file means test-after):

- **tdd** — upstream's test-driven development: failing test first, RED → GREEN → REFACTOR, TDD
  evidence in task reports, RED → GREEN fixes after the final review.
- **test-after** — code first; when a unit of work stands whole, and before its review, the
  spec/plan is reconciled with the decisions made along the way, the unit's bug-log entries are
  fixed, and one test per stated behaviour is written and checked by mutation. Plans carry an
  `Acceptance:` list instead of test code.

In both modes: a bug that does not block the work goes to `BUGS.md` and is fixed before the
unit's review or at the end; a decision that changes behaviour goes into the spec first; a
plan's Review Focus lines join the owning task's test list; the reviewer's findings about
behaviour the spec is silent on go to the partner, who puts each into the spec or rejects it;
every failure a run shows is reported by name.

### Planning lives in a tree, not in dated files

Upstream writes designs to `docs/ultrapowers/specs/YYYY-MM-DD-<topic>-design.md` and plans to
`docs/ultrapowers/plans/YYYY-MM-DD-<feature>.md`. Here both live in one phase directory, named
for what the work decides:

- `bash scripts/phase-dir phase|task|adhoc <slug>` resolves and prints
  `.ultrapowers/phases/NN-<slug>/`, allocating a number above the highest existing one and never
  reusing it. Re-running with the same slug re-resolves the same directory, so brainstorming,
  `writing-plans`, `subagent-driven-development` and `executing-plans` cannot drift to different
  places for one phase.
- The phase's own spec is `NN-SPEC.md` at that directory's root, its plan is `NN-PLAN.md`, and
  the supporting designs that fed them go in `refs/` beside them. A document serving more than
  one phase goes to `.ultrapowers/docs/`.
- The plan's workspace is named after its phase directory and records its owner; a second plan
  claiming it is refused rather than sharing it.
- Nothing in the tree is scaffolded ahead of its content: a folder appears when something belongs
  in it.

### Plan execution — subagent-driven or native

- **Tightly coupled tasks go to one agent given the whole chain**, not one per task.
- **Who writes which document is fixed.** `NN-SPEC.md` and `NN-PLAN.md` stay in the main session
  (they are dialogues); `NN-SUMMARY.md` and `NN-VERIFICATION.md` go to subagents through
  `summary-writer-prompt.md` and `verification-prompt.md`, which return a path and a verdict
  rather than the document's text.
- **Both executors end the same way.** The ledger is read cold first — one cheap subagent gets
  the ledger path and nothing else and must say what the phase is, what is done, what is open and
  what comes next; a gap is amended before anything else. Then the summary and verification are
  written, the state files brought current, and only then is the workspace deleted, file by
  name — never recursively. The summary is the record that outlives it.
- **Status files keep their history.** `ROADMAP.md` and `NN-STATE.md` are rewritten rather than
  appended to, but finished work is marked closed and keeps its entry, remaining work is hoisted
  above it, and a summary sits on top so a reader can stop early.

### Brainstorming and design records

- **Facts are yours to find; decisions are your partner's to make.** A question answerable by
  looking at the filesystem, git history or installed versions is looked up, not asked. Every
  question carries its own recommended answer and the reasoning for it, and the decision tree is
  walked in dependency order.
- **Stack drift is checked once, at design time** — `node ~/.claude/hooks/lib/stack-rules-check.mjs
  <root>`, reported only when it says `stale`.
- **Two design sections are required**: *Testing Decisions* (the acceptance list the tests will
  confirm, and the seams at which the behaviour will be verified) and *Out of Scope*.
- **A glossary entry is written the moment a term is sharpened**, not batched at the end.
- **An ADR is written only when the decision is hard to reverse, surprising without context and a
  real trade-off** — all three.

### Planning checks that execute

Upstream's plan self-review checks are read with fresh eyes. Here checks 5 and 6 are *run*: every
command the plan tells an implementer to run is run first, in the worktree they will use — in
test-after mode only what exists at plan time — and every invariant stated in a task's
Interfaces block is executed against that task's own sample code.

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
| `006-grilling-fact-lookup` | interview discipline in brainstorming |
| `007-planning-tree` | the phase directory replaces dated `docs/` paths; phase-named workspaces |
| `008-sdd-summary` | cold ledger read-back and `NN-SUMMARY` before the workspace is deleted by name |
| `009-agent-first` | who writes which document; state files that keep history; coupled tasks to one agent |
| `010-design-records` | stack-drift check, required sections, glossary and ADR discipline |
| `011-planning-rules-are-run` | plan checks 5 and 6 execute instead of being read |
| `014-test-after-coverage` | the testing mode (tdd / test-after), the bug log, out-of-spec findings to the partner |
| `015-diagnosing-in-project` | diagnosing in the project scratchpad, no GitHub issues, analysts on permission |

Three files are the fork's own rather than a patch on upstream's:
`skills/brainstorming/scripts/phase-dir`,
`skills/subagent-driven-development/summary-writer-prompt.md` and
`skills/subagent-driven-development/verification-prompt.md`.

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
