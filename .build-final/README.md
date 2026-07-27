# ultrapowers

A fork of [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT),
narrowed to Claude Code and maintained as a generated artifact rather than a hand-edited copy.

The plugin itself, and what it is, is documented in
[`plugins/ultrapowers/README.md`](plugins/ultrapowers/README.md). This file is about the
repository.

## Install

```
/plugin marketplace add axazolai/ultrapowers
/plugin install ultrapowers@ultrapowers
```

The repository is its own marketplace, so a fresh machine needs no git authentication for this.

## Three branches, three kinds of thing

They are orphan-rooted and share no ancestry, because merging them is never the right operation.

| branch | holds | edited by |
|---|---|---|
| `original` | upstream's tree, verbatim — one commit per release, tagged `upstream/<version>` | only by recording a new upstream release |
| `patch` | the plugin map, the rename transform, the fork-owned files, and our deltas | by hand, deliberately |
| `main` | the generated plugin | never by hand |

`original` exists so that "which base was this built from" has an answer that cannot move.
`upstream/main` can be force-pushed; a tag in our own repository cannot be changed under us.

## What is carried across, and what is not

`transform/inventory.json` classifies every upstream path as `tracked` (carried across, renamed,
watched for upstream changes) or `ignored` (deliberately not shipped), each with a recorded
reason. Of upstream 6.2.0's 180 files, 51 are tracked: the plugin manifest, the `SessionStart`
hook, the skills, and `LICENSE`. The rest are other harnesses, upstream's own test suite, their
docs and their release tooling.

Rules propose, the manifest confirms. A path that appears upstream but is absent from the
manifest is **new**, and the build refuses until a human classifies it. Globs alone would quietly
adopt whatever upstream adds; a bare file list would be unmaintainable. Both together give the
gate and the maintainability.

## Rebuilding

```
node transform/inventory.mjs check    # the map still describes upstream
node --test                           # the transform still behaves
node transform/build-cli.mjs check    # the plugin still builds, with nothing surviving that should not
node transform/build-cli.mjs commit   # write the result to main
```

The build refuses, rather than producing a plausible-looking broken plugin, when: an upstream path
is unclassified or new, a delta no longer applies, the upstream name survives outside the one
protected string, or the attribution the licence requires is missing from the built tree.

`obsolete` is reported but does not refuse: a delta whose change upstream has since made itself is
a decision to take, not an error. Dead deltas are how forks accumulate the burden that makes
people abandon them, so they are surfaced every build and removed on purpose.

## Licence

MIT, Copyright (c) 2025 Jesse Vincent. The notice in `LICENSE` is upstream's and is reproduced
byte-for-byte; the build asserts this and fails without it.
