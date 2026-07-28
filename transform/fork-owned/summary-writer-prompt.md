# Summary Writer Prompt

**Dispatch when:** the final whole-branch review is clean and its fixes are merged.

**Model:** a mid-tier model. This is a fold of existing text, not a judgement about the code.

**Why a subagent:** the ledger and the implementer reports run to tens of thousands of tokens.
The controller that reaches this point is already carrying the plan and every coordination
decision; reading the drafts itself is what this dispatch exists to avoid.

```
Subagent (general-purpose):

Write the phase summary for a completed plan.

INPUTS
- Ledger: <workspace>/progress.md
- Implementer reports: <workspace>/task-*-report.md
- Plan: <plan file path>
- Destination: <phase dir>/<NN>-SUMMARY.md

Read the ledger first, then every report. Do not read the diffs or the task briefs — they are
regenerable and they are not what this document is for.

WRITE the destination file with these sections, in this order:

## Tasks
One line per task: the task number, its one-line deliverable, and its commit range as
`<base7>..<head7>`. Take the range from the ledger's completion line, never from your own
reading of git log.

## Rulings
Every finding the ledger records as parked, with its ruling. **Copy each ruling verbatim.**
Do not summarise, soften, merge or re-word them. These are the least flattering and most
valuable content in the whole record, and they are the first thing a fold smooths away. If a
ruling is three sentences of hedging, three sentences of hedging is what the file gets.
Include deferred minors the same way. If the ledger records none, write `None.` — not an
omitted section.

## Deviations and decisions
From the implementer reports: where the plan turned out to be wrong, what was tried and
abandoned, and what was decided on the spot. Extract these; do not copy the reports wholesale.
An implementer's report is mostly narration of work that git already records — what belongs
here is only what the code cannot show.

## Reviews
For each review, BOTH references on one line:
`<workspace-relative path>.diff` — `git diff <base7>..<head7>`
Two references because they fail at different times: while the workspace is on disk the file
is right there and opening it beats regenerating it; once the scratch is cleared the path goes
stale and the hash range still reconstructs the same diff exactly.

CONSTRAINTS
- Never paste diff content into the summary. It is byte-identical to what git already stores.
- Expect 15–30 KB for a large plan. If you are far above that, you are copying rather than
  folding.
- If the ledger and a report disagree about what happened, say so in `## Deviations and
  decisions` and name both. Do not pick a winner.

RETURN
One line only: the absolute path of the file you wrote, and the number of tasks, rulings and
reviews it covers. Returning the document's text spends on the way back exactly what this
dispatch saved.
```
