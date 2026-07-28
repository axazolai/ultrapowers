import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "./build.mjs";

const CFG = {
  substitutions: [
    { from: "superpowers", to: "ultrapowers" },
    { from: "Superpowers", to: "Ultrapowers" },
    { from: "SUPERPOWERS", to: "ULTRAPOWERS" },
  ],
  protect: ["obra/superpowers"],
  attribution: {
    require: [
      { path: "plugins/ultrapowers/LICENSE", verbatimFrom: "LICENSE", reason: "MIT copyright must survive" },
      { path: "plugins/ultrapowers/README.md", contains: ["obra/superpowers"], reason: "fork must name upstream" },
    ],
  },
};

const INVENTORY = {
  pluginRoot: "plugins/ultrapowers",
  rules: [
    { match: "LICENSE", class: "tracked", mode: "verbatim", alsoAtRoot: true, reason: "MIT obligation, verbatim" },
    { match: "skills/**", class: "tracked", reason: "the skills library" },
    { match: ".claude-plugin/plugin.json", class: "tracked", reason: "plugin manifest" },
    { match: "docs/**", class: "ignored", reason: "upstream development record" },
  ],
  manifest: {
    "LICENSE": "tracked",
    "skills/using-superpowers/SKILL.md": "tracked",
    ".claude-plugin/plugin.json": "tracked",
    "docs/plan.md": "ignored",
  },
  forkOwned: [{ src: "fork-owned/README.md", dest: "plugins/ultrapowers/README.md", reason: "fork-owned readme" }],
};

const LICENSE = "MIT License\n\nCopyright (c) 2025 Jesse Vincent\n";

function tree() {
  return new Map([
    ["LICENSE", { mode: "100644", text: LICENSE }],
    ["skills/using-superpowers/SKILL.md", { mode: "100755", text: "Superpowers: run superpowers:brainstorming\nsee obra/superpowers\n" }],
    [".claude-plugin/plugin.json", { mode: "100644", text: '{\n  "name": "superpowers",\n  "version": "6.2.0"\n}\n' }],
    ["docs/plan.md", { mode: "100644", text: "superpowers internals\n" }],
  ]);
}

const FORK_OWNED = new Map([["fork-owned/README.md", "Ultrapowers is a fork of obra/superpowers.\n"]]);

function run(over = {}) {
  return build({ tree: tree(), cfg: CFG, inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [], ...over });
}

test("tracked files land under the plugin root with renamed paths", () => {
  const r = run();
  assert.ok(r.files.has("plugins/ultrapowers/skills/using-ultrapowers/SKILL.md"));
  assert.ok(r.files.has("plugins/ultrapowers/.claude-plugin/plugin.json"));
});

test("ignored files do not reach the output at all", () => {
  const r = run();
  assert.equal([...r.files.keys()].some((p) => p.includes("docs/plan.md")), false);
});

test("a verbatim file is not renamed and is emitted at the repository root as well", () => {
  const r = run();
  assert.equal(r.files.get("plugins/ultrapowers/LICENSE").text, LICENSE);
  assert.equal(r.files.get("LICENSE").text, LICENSE);
});

test("the executable bit survives the transform", () => {
  const r = run();
  assert.equal(r.files.get("plugins/ultrapowers/skills/using-ultrapowers/SKILL.md").mode, "100755");
});

test("fork-owned files are overlaid at their destination", () => {
  const r = run();
  assert.match(r.files.get("plugins/ultrapowers/README.md").text, /fork of obra\/superpowers/);
});

test("deltas see the renamed tree, so they never encode the rename themselves", () => {
  const delta = {
    name: "001-x.patch",
    text: `--- a/plugins/ultrapowers/skills/using-ultrapowers/SKILL.md\n+++ b/plugins/ultrapowers/skills/using-ultrapowers/SKILL.md\n@@ -1,2 +1,3 @@\n Ultrapowers: run ultrapowers:brainstorming\n+GRAFTED\n see obra/superpowers\n`,
  };
  const r = run({ deltas: [delta] });
  assert.deepEqual(r.applied, ["001-x.patch"]);
  assert.match(r.files.get("plugins/ultrapowers/skills/using-ultrapowers/SKILL.md").text, /GRAFTED/);
});

test("a delta that no longer applies is reported by name, never silently dropped", () => {
  const delta = {
    name: "002-stale.patch",
    text: `--- a/plugins/ultrapowers/skills/using-ultrapowers/SKILL.md\n+++ b/plugins/ultrapowers/skills/using-ultrapowers/SKILL.md\n@@ -1,2 +1,3 @@\n line upstream deleted\n+X\n another gone line\n`,
  };
  const r = run({ deltas: [delta] });
  assert.deepEqual(r.failed, ["002-stale.patch"]);
});

test("a change upstream has since made itself is obsolete, and does not fail the build", () => {
  const delta = {
    name: "003-done-upstream.patch",
    text: `--- a/plugins/ultrapowers/.claude-plugin/plugin.json\n+++ b/plugins/ultrapowers/.claude-plugin/plugin.json\n@@ -2 +2 @@\n-  "name": "old",\n+  "name": "ultrapowers",\n`,
  };
  const r = run({ deltas: [delta] });
  assert.deepEqual(r.obsolete, ["003-done-upstream.patch"]);
  assert.deepEqual(r.failed, []);
});

test("missing attribution is reported with the requirement that failed", () => {
  const r = build({
    tree: tree(), cfg: CFG, inventory: INVENTORY, deltas: [],
    forkOwned: new Map([["fork-owned/README.md", "no credit here\n"]]),
  });
  assert.equal(r.attributionMissing.length, 1);
  assert.match(r.attributionMissing[0].detail, /obra\/superpowers/);
});

test("a verbatim attribution requirement compares against the untransformed source", () => {
  const t = tree();
  t.set("LICENSE", { mode: "100644", text: "tampered\n" });
  const r = build({ tree: t, cfg: CFG, inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [] });
  assert.equal(r.attributionMissing.length, 0, "matching bytes, however odd, are not an attribution failure");
});

test("an upstream name surviving outside the protected slug is reported", () => {
  const t = tree();
  t.set("skills/using-superpowers/SKILL.md", { mode: "100644", text: "SuperPowers mixed case slips through\n" });
  const r = build({ tree: t, cfg: CFG, inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [] });
  assert.equal(r.residual.length, 1);
  assert.match(r.residual[0].text, /SuperPowers/);
});

test("the protected slug is not counted as residual - it is there on purpose", () => {
  const r = run();
  assert.deepEqual(r.residual, []);
});

test("an upstream path the map does not cover is reported as drift, never silently dropped", () => {
  const t = tree();
  t.set("commands/new.md", { mode: "100644", text: "hi\n" });
  const r = build({ tree: t, cfg: CFG, inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [] });
  assert.deepEqual(r.mapDrift.unclassified, ["commands/new.md"]);
});

test("two builds of the same input produce identical output, path order included", () => {
  const a = run(), b = run();
  assert.deepEqual([...a.files.keys()], [...b.files.keys()]);
  assert.deepEqual(
    [...a.files].map(([p, f]) => [p, f.mode, f.text]),
    [...b.files].map(([p, f]) => [p, f.mode, f.text]),
  );
});

test("output paths are emitted in sorted order, so the tree hash cannot depend on input order", () => {
  const keys = [...run().files.keys()];
  assert.deepEqual(keys, [...keys].sort());
});

// The version is derived from the recorded base, never written into a delta. A version baked into
// a patch is correct exactly until upstream publishes a new release - the one moment it must be
// right. These two cases are the whole argument.
const VERSIONED = { ...CFG, originalTag: "upstream/6.2.0", version: { revision: 1 } };

test("the shipped version is derived from the recorded base and our revision", () => {
  const r = build({ tree: tree(), cfg: VERSIONED, inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [] });
  assert.equal(r.version, "6.2.0-up.1");
  assert.match(r.files.get("plugins/ultrapowers/.claude-plugin/plugin.json").text, /"version": "6\.2\.0-up\.1"/);
});

test("a new upstream release moves the version with no delta edited", () => {
  const r = build({ tree: tree(), cfg: { ...VERSIONED, originalTag: "upstream/6.3.0", version: { revision: 2 } },
    inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [] });
  assert.equal(r.version, "6.3.0-up.2");
});

test("a manifest with no version field is a loud failure, not a silent unversioned plugin", () => {
  const t = tree();
  t.set(".claude-plugin/plugin.json", { mode: "100644", text: '{\n  "name": "superpowers"\n}\n' });
  assert.throws(() => build({ tree: t, cfg: VERSIONED, inventory: INVENTORY, forkOwned: FORK_OWNED, deltas: [] }), /version field/);
});

test("fork-owned files carry their declared mode, defaulting to 100644", () => {
  const inventory = {
    pluginRoot: "plugins/ultrapowers",
    rules: [],
    manifest: [],
    forkOwned: [
      { src: "fork-owned/runme", dest: "plugins/ultrapowers/skills/x/scripts/runme", mode: "100755" },
      { src: "fork-owned/plain.md", dest: "plugins/ultrapowers/skills/x/plain.md" },
    ],
  };
  const forkOwned = new Map([
    ["fork-owned/runme", "#!/usr/bin/env bash\nexit 0\n"],
    ["fork-owned/plain.md", "text\n"],
  ]);
  const result = build({ tree: new Map(), cfg: { substitutions: [], protect: [] }, inventory, forkOwned });
  assert.equal(result.files.get("plugins/ultrapowers/skills/x/scripts/runme").mode, "100755");
  assert.equal(result.files.get("plugins/ultrapowers/skills/x/plain.md").mode, "100644");
});
