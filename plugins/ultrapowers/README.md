# Ultrapowers

A skills library for Claude Code: test-driven development, systematic debugging, planning,
code review and the collaboration patterns that hold them together. Skills load on demand and
announce themselves, so you can see which one is driving.

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

- **Claude Code only.** The other six harnesses' plugin manifests, adapters and per-harness skill
  references are not carried across, and neither is upstream's own test suite, release tooling or
  development history. What ships is the plugin: its manifest, its `SessionStart` hook, and the
  skills.
- **Renamed throughout**, so both can be installed side by side and a skill invocation is
  unambiguous: `ultrapowers:brainstorming` resolves here, and upstream's skills keep their own
  namespace rather than colliding with these.
- **A structural pre-pass in code review**, wired to `fallow` when it is available and silent when
  it is not.

Everything else is upstream's work, carried across unchanged.

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
