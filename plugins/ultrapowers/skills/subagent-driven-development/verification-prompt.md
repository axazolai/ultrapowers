# Verification Prompt

**Dispatch when:** the plan's tasks are complete and you need the phase's goal checked against
what the branch actually contains — before finishing the branch, not after.

**Model:** a capable model. Deciding whether a goal was met is judgement, even though the
inputs are bulk.

```
Subagent (general-purpose):

Verify that a completed phase achieved its goal, and write the verification document.

INPUTS
- Plan: <plan file path>
- Branch diff: <review package path>
- Destination: <phase dir>/<NN>-VERIFICATION.md

Work goal-backward. Start from the plan's **Goal** and **Global Constraints**, not from its
task list: a plan whose every task is ticked can still miss what it was for.

WRITE the destination file with these sections:

## Goal
The plan's goal, quoted, and a one-line verdict: ACHIEVED, PARTIAL or NOT ACHIEVED.

## Evidence
For each claim in the goal, the concrete thing in the branch that delivers it — file and
symbol, or the test that covers it. A claim with no evidence is not achieved, however
plausible the code looks.

## Global constraints
One line per constraint from the plan's Global Constraints section: HELD or VIOLATED, with the
file and line where you checked. Every constraint gets a line, including the ones that are
obviously fine.

## Gaps
What the plan promised and the branch does not contain. Empty is a valid answer; an invented
gap to look thorough is worse than none.

CONSTRAINTS
- Verify against the diff and the code, never against the implementer reports. Reports say
  what was intended; you are checking what landed.
- Do not fix anything. You are not an implementer, and a fix you make is a fix nobody reviews.
- Where you cannot verify a claim from the material given, say so explicitly under `## Gaps`
  as `unverifiable: <claim> — <what would settle it>`. Silence reads as verified.

RETURN
One line only: the absolute path of the file you wrote and the verdict.
```
