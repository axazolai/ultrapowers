---
name: test-driven-development
description: Use when a unit of work's code is complete, before its review — writes the tests that confirm the spec/plan
---

# Spec-Driven Tests

## Overview

Write the code first. When a unit of work stands as a working whole, and before it goes to
review, write the tests that confirm what the spec or plan states — and only those.

A **unit of work** is what one review covers: a plan task under per-task review, otherwise the
whole change.

## The Order

At the end of a unit of work:

1. **Reconcile.** A decision made during the work that changed behaviour, scope or an interface
   is written into the spec and/or plan first. The tests follow the updated text.
2. **Drain the bug log** for this unit: fix its open entries (see Bug Log below).
3. **Write the tests.** One per behaviour or acceptance criterion the spec or plan states. A
   behaviour the spec does not state gets no test; if it matters, it goes into the spec first.
4. **Run them.**
5. **Review.**

At the end of the whole work, before the final review: drain what is left in the bug log.

## Bug Log

A bug found during the work that does not block the next step goes to the project's bug log and
the work continues. A bug that blocks the next step is fixed at once.

- File: `BUGS.md`. The project `CLAUDE.md` names its location; none stated: the project root.
- Entry: `BUG-NNN`, date, where (file:line or command), symptom, reproduction, unit of work,
  status `Open`/`Fixed`.
- Drain: before a unit's tests, fix that unit's open entries; at the end of the work, fix the
  rest. An entry outside the work's scope is listed to the user instead of fixed.
- Fixed entries stay, compressed to a line.
- Fix a logged bug with `ultrapowers:systematic-debugging`.

## What Gets a Test

| Case | Test |
|------|------|
| Behaviour the spec/plan states | One test per behaviour or criterion |
| Behaviour the spec does not state | None — add it to the spec first if it matters |
| Fixed bug that broke stated behaviour | That behaviour's test is the regression test |
| Fixed bug outside stated behaviour | None |
| Standalone bug fix, no spec | The report's expected behaviour, one test, after the fix |
| Wiring, config, trivial mappers, passthroughs | None — covered by the test of what they enable |

## The Mutation Check

No RED step. Before finishing a test file, mentally mutate the code; at least one test fails for
each realistic mutation:

- Wrong constant or argument
- Wrong branch handler
- Missing state change or side effect
- Empty or default return
- Missing validation for zero, empty, nil, unauthorized, or malformed input

A mutation nothing catches is either a stated behaviour left unprotected — add its test — or a
behaviour outside the spec — leave it.

## Writing the Tests

See @writing-good-tests.md: name the break each test catches, exercise the real thing, derive
expectations by hand.

## Checklist

- [ ] Spec/plan updated for every decision that changed behaviour, scope or an interface
- [ ] This unit's bug-log entries fixed
- [ ] Every stated behaviour has a test; no test covers an unstated one
- [ ] Mutation check done
- [ ] Tests run, output pristine
- [ ] Then review
