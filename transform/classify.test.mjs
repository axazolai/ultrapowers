import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { matchRule, classify, reconcile, assertReasoned } from "./classify.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const inventory = JSON.parse(readFileSync(join(HERE, "inventory.json"), "utf8"));
const config = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));

const RULES = [
  { match: "skills/using-superpowers/references/**", class: "ignored", reason: "other harnesses only" },
  { match: "skills/**", class: "tracked", reason: "the skills library itself" },
  { match: "LICENSE", class: "tracked", mode: "verbatim", reason: "MIT obligation, verbatim" },
  { match: "docs/**", class: "ignored", reason: "upstream development record" },
];

test("an exact rule matches only that path", () => {
  assert.equal(matchRule("LICENSE", RULES[2]), true);
  assert.equal(matchRule("LICENSE.md", RULES[2]), false);
  assert.equal(matchRule("sub/LICENSE", RULES[2]), false);
});

test("a trailing /** matches everything below the directory", () => {
  assert.equal(matchRule("docs/a/b.md", RULES[3]), true);
  assert.equal(matchRule("docs-other/a.md", RULES[3]), false);
});

test("rule order decides: the narrower ignored rule wins over skills/**", () => {
  assert.equal(classify("skills/using-superpowers/references/pi-tools.md", RULES).class, "ignored");
  assert.equal(classify("skills/using-superpowers/SKILL.md", RULES).class, "tracked");
});

test("an unsupported pattern throws instead of silently matching nothing", () => {
  assert.throws(() => matchRule("a/b.md", { match: "a/*.md" }), /unsupported pattern/);
});

test("an upstream path no rule covers is reported unclassified, never guessed", () => {
  const r = reconcile({ paths: ["commands/foo.md"], rules: RULES, manifest: {} });
  assert.deepEqual(r.unclassified, ["commands/foo.md"]);
  assert.equal(r.tracked.length + r.ignored.length, 0);
});

test("a new upstream path is reported with a proposed class but is not silently accepted", () => {
  const r = reconcile({ paths: ["skills/new-skill/SKILL.md"], rules: RULES, manifest: {} });
  assert.deepEqual(r.added, [{ path: "skills/new-skill/SKILL.md", proposed: "tracked", reason: "the skills library itself" }]);
});

test("a path already in the manifest is not reported as new", () => {
  const r = reconcile({ paths: ["LICENSE"], rules: RULES, manifest: { LICENSE: "tracked" } });
  assert.deepEqual(r.added, []);
});

test("a manifest path upstream no longer ships is reported removed", () => {
  const r = reconcile({ paths: ["LICENSE"], rules: RULES, manifest: { LICENSE: "tracked", "docs/gone.md": "ignored" } });
  assert.deepEqual(r.removed, ["docs/gone.md"]);
});

test("a rule change that reclassifies a recorded path is surfaced", () => {
  const r = reconcile({ paths: ["docs/a.md"], rules: RULES, manifest: { "docs/a.md": "tracked" } });
  assert.deepEqual(r.reclassified, [{ path: "docs/a.md", was: "tracked", now: "ignored" }]);
});

test("every rule in the real inventory carries a usable reason", () => {
  assertReasoned(inventory.rules);
});

test("every fork-owned file carries a reason and a destination", () => {
  for (const f of inventory.forkOwned) {
    assert.ok(f.reason && f.reason.length > 10, `${f.src} has no reason`);
    assert.ok(f.dest, `${f.src} has no dest`);
  }
});

test("the map and the transform config describe the same upstream base", () => {
  assert.equal(inventory.describesTree, config.originalTree);
  assert.equal(inventory.describesTag, config.originalTag);
});

test("every attribution requirement carries a reason and something to assert", () => {
  for (const a of config.attribution.require) {
    assert.ok(a.reason && a.reason.length > 10, `${a.path} has no reason`);
    assert.ok(a.contains?.length || a.verbatimFrom, `${a.path} asserts nothing`);
  }
});

test("the real rule set classifies every recorded upstream path, and the manifest agrees", () => {
  const paths = Object.keys(inventory.manifest);
  assert.ok(paths.length > 0, "manifest is empty - run `node transform/inventory.mjs sync`");
  const r = reconcile({ paths, rules: inventory.rules, manifest: inventory.manifest });
  assert.deepEqual(r.unclassified, []);
  assert.deepEqual(r.reclassified, []);
  assert.deepEqual(r.added, []);
});
