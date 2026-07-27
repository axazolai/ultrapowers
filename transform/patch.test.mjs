import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePatch, applyPatch } from "./patch.mjs";

const BASE = ["one", "two", "three", "four", "five"].join("\n") + "\n";

const SIMPLE = `--- a/f.txt
+++ b/f.txt
@@ -1,3 +1,4 @@
 one
 two
+two-and-a-half
 three
`;

test("parses path and hunk geometry from a unified diff", () => {
  const [file] = parsePatch(SIMPLE);
  assert.equal(file.path, "f.txt");
  assert.equal(file.hunks.length, 1);
  assert.deepEqual(
    { oldStart: file.hunks[0].oldStart, oldLines: file.hunks[0].oldLines, newLines: file.hunks[0].newLines },
    { oldStart: 1, oldLines: 3, newLines: 4 },
  );
});

test("strips the a/ and b/ prefixes git writes", () => {
  const [file] = parsePatch(`diff --git a/x/y.md b/x/y.md\nindex 000..111 100644\n--- a/x/y.md\n+++ b/x/y.md\n@@ -1 +1 @@\n-a\n+b\n`);
  assert.equal(file.path, "x/y.md");
});

test("applies a hunk that matches exactly", () => {
  const r = applyPatch(new Map([["f.txt", BASE]]), parsePatch(SIMPLE)[0]);
  assert.equal(r.outcome, "applied");
  assert.equal(r.content, ["one", "two", "two-and-a-half", "three", "four", "five"].join("\n") + "\n");
});

test("content outside the hunk survives byte-for-byte", () => {
  const noisy = "header\n" + BASE + "trailer\n";
  const r = applyPatch(new Map([["f.txt", noisy]]), parsePatch(SIMPLE)[0]);
  assert.equal(r.outcome, "applied");
  assert.ok(r.content.startsWith("header\n"));
  assert.ok(r.content.endsWith("trailer\n"));
});

test("applies despite line-number drift, because upstream edits move our context", () => {
  const shifted = "a\nb\nc\nd\n" + BASE;
  const r = applyPatch(new Map([["f.txt", shifted]]), parsePatch(SIMPLE)[0]);
  assert.equal(r.outcome, "applied");
  assert.match(r.content, /two\ntwo-and-a-half\nthree/);
});

test("a change upstream already made is obsolete, not a failure", () => {
  const already = ["one", "two", "two-and-a-half", "three", "four", "five"].join("\n") + "\n";
  const r = applyPatch(new Map([["f.txt", already]]), parsePatch(SIMPLE)[0]);
  assert.equal(r.outcome, "obsolete");
});

test("applying the same delta twice is detected the second time", () => {
  const files = new Map([["f.txt", BASE]]);
  const patch = parsePatch(SIMPLE)[0];
  const first = applyPatch(files, patch);
  files.set("f.txt", first.content);
  assert.equal(applyPatch(files, patch).outcome, "obsolete");
});

test("context that no longer exists fails loudly instead of guessing a location", () => {
  const r = applyPatch(new Map([["f.txt", "totally\ndifferent\n"]]), parsePatch(SIMPLE)[0]);
  assert.equal(r.outcome, "failed");
  assert.match(r.detail, /context/i);
});

test("a delta aimed at a file the build does not have fails", () => {
  const r = applyPatch(new Map(), parsePatch(SIMPLE)[0]);
  assert.equal(r.outcome, "failed");
  assert.match(r.detail, /f\.txt/);
});

test("every hunk of a multi-hunk delta is applied", () => {
  const patch = parsePatch(`--- a/f.txt
+++ b/f.txt
@@ -1,2 +1,3 @@
 one
+ONE-B
 two
@@ -4,2 +5,3 @@
 four
+FOUR-B
 five
`)[0];
  const r = applyPatch(new Map([["f.txt", BASE]]), patch);
  assert.equal(r.outcome, "applied");
  assert.equal(r.content, ["one", "ONE-B", "two", "three", "four", "FOUR-B", "five"].join("\n") + "\n");
});

test("a deletion hunk removes exactly its lines", () => {
  const patch = parsePatch(`--- a/f.txt\n+++ b/f.txt\n@@ -2,3 +2,2 @@\n two\n-three\n four\n`)[0];
  const r = applyPatch(new Map([["f.txt", BASE]]), patch);
  assert.equal(r.outcome, "applied");
  assert.equal(r.content, ["one", "two", "four", "five"].join("\n") + "\n");
});

test("a partially-applied delta is failed, never half-written", () => {
  const patch = parsePatch(`--- a/f.txt
+++ b/f.txt
@@ -1,2 +1,3 @@
 one
+ONE-B
 two
@@ -4,2 +5,3 @@
 nonexistent
+X
 lines
`)[0];
  const r = applyPatch(new Map([["f.txt", BASE]]), patch);
  assert.equal(r.outcome, "failed");
  assert.equal(r.content, undefined);
});
