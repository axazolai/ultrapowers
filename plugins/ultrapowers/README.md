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

Built from **upstream 6.2.0**; the plugin reports its version as `<upstream>-up.<revision>`, so
this build is `6.2.0-up.5`. Everything not listed below is upstream's work, carried across
unchanged.

### Scope and identity

- **Claude Code only.** The other six harnesses' plugin manifests, adapters and per-harness skill
  references are not carried across, and neither is upstream's own test suite, release tooling or
  development history. 51 of upstream's 180 files ship: the manifest, the `SessionStart` hook, the
  skills, and `LICENSE`. `using-ultrapowers` loses its "Platform Adaptation" section along with
  the reference files it pointed at, and the brainstorming server reads its version from
  `.claude-plugin/plugin.json` alone.
- **Renamed throughout**, so both can be installed side by side and a skill invocation is
  unambiguous: `ultrapowers:brainstorming` resolves here, and upstream's skills keep their own
  namespace rather than colliding with these.
- **The manifest and the brand link point at this fork** — homepage, repository, author — while
  the description names upstream, so `/plugin` shows where the plugin came from without anyone
  opening the README.

### Planning lives in a tree, not in dated files

Upstream writes designs to `docs/ultrapowers/specs/YYYY-MM-DD-<topic>-design.md` and plans to
`docs/ultrapowers/plans/YYYY-MM-DD-<feature>.md`. Here both live in one phase directory, named
for what the work decides:

- `bash scripts/phase-dir phase|task|adhoc <slug>` resolves and prints
  `.ultrapowers/phases/NN-<slug>/`, allocating a number above the highest existing one and never
  reusing it. Re-running with the same slug re-resolves the same directory, so brainstorming,
  `writing-plans` and `subagent-driven-development` cannot drift to different places for one
  phase.
- The phase's own spec is `NN-SPEC.md` at that directory's root, its plan is `NN-PLAN.md`, and
  the supporting designs that fed them go in `refs/` beside them. A document serving more than
  one phase goes to `.ultrapowers/docs/`.
- Nothing in the tree is scaffolded ahead of its content: a folder appears when something belongs
  in it.

### Subagent-driven development

- **Agent-driven execution is the norm**, and the decision tree says so: a phase artefact or more
  than one commit means an agent; tightly coupled tasks mean *one* agent given the whole chain,
  not one per task; a single edit in a known location is offered as a choice rather than decided
  silently. Absence of a plan is a reason to write one, not an execution route.
- **Who writes which document is fixed.** `NN-SPEC.md` and `NN-PLAN.md` stay in the main session
  (they are dialogues); `NN-SUMMARY.md` and `NN-VERIFICATION.md` go to subagents through
  `summary-writer-prompt.md` and `verification-prompt.md`, which return a path and a verdict
  rather than the document's text — returning the text would spend on the way back exactly what
  delegating saved. Verification works goal-backward: a plan whose every task is ticked can still
  miss what it was for.
- **The workspace survives the phase.** Upstream deletes the plan's workspace once the final
  review is clean; here the summary is written and the workspace kept.
- **The ledger is read cold, and that is tested.** Every entry must stand on its own — task
  number, commit range, ruling, deviation. Before the summary is written, one cheap subagent gets
  the ledger path and *nothing else* and must answer what the phase is, what is done, what is
  open and what comes next. The moment it needs another file, the gap is amended in the ledger
  first. This is the only point where "the ledger is the recovery map" is checked rather than
  assumed.
- **Status files keep their history.** `ROADMAP.md` and `NN-STATE.md` are rewritten rather than
  appended to, but finished work is marked closed and keeps its entry, remaining work is hoisted
  above it, and a summary sits on top so a reader can stop early. A paid debt's entry may be
  compressed to its name, one line and the closed mark — never deleted.

### Brainstorming and design records

- **Facts are yours to find; decisions are your partner's to make.** A question answerable by
  looking at the filesystem, git history or installed versions is looked up, not asked. Every
  question carries its own recommended answer and the reasoning for it, and the decision tree is
  walked in dependency order.
- **Stack drift is checked once, at design time** — `node ~/.claude/hooks/lib/stack-rules-check.mjs
  <root>`, reported only when it says `stale`. Design happens orders of magnitude less often than
  a session starts, which is what makes this the right moment and every other moment noise.
- **Two design sections are required**: *Testing Decisions* (the seams at which the behaviour
  will be verified, stated as intent rather than as a file or a class) and *Out of Scope*.
- **A glossary entry is written the moment a term is sharpened**, not batched at the end.
- **An ADR is written only when the decision is hard to reverse, surprising without context and a
  real trade-off** — all three. A register of rubber-stamped entries stops being read.

### Planning checks that execute

Upstream's plan self-review is five checks read with fresh eyes. Here checks 4 and 5 are *run*:
every command the plan tells an implementer to run is run first, in the worktree they will use
(a worktree lacks whatever the repository git-ignores, so a command that passes where it was
written can fail where it is run), and every invariant stated in a task's Interfaces block is
executed against that task's own sample code. When one sample turns out wrong, the plan is swept
for the whole class — a defect in a code sample is evidence about the plan, not about one task.

### Code review

A **structural pre-pass** runs before the checks: `fallow` over the changed files, folded into
the Issues section at the severity it reports. In a GSD project (`.planning/` exists) it is
skipped, because GSD's own review owns that pass there; with no `fallow` binary it degrades to
one Minor note naming the install command. A missing binary never fails a review.

### The deltas, for completeness

Each change above is one numbered patch on the `patch` branch, applied at build time:

| delta | what it changes |
|---|---|
| `001-fallow-graft` | the structural pre-pass in code review |
| `002-drop-platform-adaptation` | removes the other harnesses' reference files from `using-ultrapowers` |
| `003-plugin-version-source` | the brainstorming server reads the Claude Code manifest only |
| `004-plugin-manifest` | fork identity in `plugin.json`, upstream credited in the description |
| `005-brand-link` | the brainstorming UI's brand link points at this fork |
| `006-grilling-fact-lookup` | interview discipline in brainstorming |
| `007-planning-tree` | the phase directory replaces dated `docs/` paths |
| `008-sdd-summary` | the workspace is kept and folded into `NN-SUMMARY` |
| `009-agent-first` | agent-driven execution as the norm; who writes which document |
| `010-design-records` | stack-drift check, required sections, glossary and ADR discipline |
| `011-planning-rules-are-run` | plan checks 4 and 5 execute instead of being read |
| `012-ledger-read-back` | the cold ledger read-back before the summary |
| `013-status-files-keep-history` | status files compress history instead of dropping it |

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
