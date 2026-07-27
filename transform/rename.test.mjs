import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renameText, renamePath } from "./rename.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));

test("substitutes every case form in prose", () => {
  assert.equal(renameText("Superpowers gives you superpowers", cfg), "Ultrapowers gives you ultrapowers");
  assert.equal(renameText("SUPERPOWERS", cfg), "ULTRAPOWERS");
});

test("substitutes the skill namespace so invocation names are real", () => {
  assert.equal(renameText("superpowers:brainstorming", cfg), "ultrapowers:brainstorming");
});

test("substitutes inside an identifier, because a half-renamed symbol does not compile", () => {
  assert.equal(renameText("function readSuperpowersVersion() {}", cfg), "function readUltrapowersVersion() {}");
});

test("rewrites paths, including directory components", () => {
  assert.equal(renamePath("skills/using-superpowers/SKILL.md", cfg), "skills/using-ultrapowers/SKILL.md");
  assert.equal(renamePath("hooks/session-start", cfg), "hooks/session-start");
});

test("upstream's repository slug is never rewritten - it is upstream's identity, not ours", () => {
  assert.equal(
    renameText("See https://github.com/obra/superpowers/issues/571", cfg),
    "See https://github.com/obra/superpowers/issues/571",
  );
});

test("protection is local: substitutable text adjacent to a protected slug still changes", () => {
  assert.equal(
    renameText("superpowers lives at obra/superpowers and Superpowers rocks", cfg),
    "ultrapowers lives at obra/superpowers and Ultrapowers rocks",
  );
});

test("a longer protected string wins over a shorter one it contains", () => {
  const overlapping = { substitutions: cfg.substitutions, protect: ["obra/superpowers", "github.com/obra/superpowers"] };
  assert.equal(
    renameText("github.com/obra/superpowers and superpowers", overlapping),
    "github.com/obra/superpowers and ultrapowers",
  );
});

test("text with no occurrence comes back identical - LICENSE must survive untouched", () => {
  const license = "MIT License\n\nCopyright (c) 2025 Jesse Vincent\n";
  assert.equal(renameText(license, cfg), license);
});

test("a NUL byte is refused rather than silently corrupting the mask", () => {
  assert.throws(() => renameText(`superpowers ${String.fromCharCode(0)} x`, cfg), /NUL/);
});

test("the engine has no path parameter at all, so no path-shaped judgement can hide in it", () => {
  assert.equal(renameText.length, 2);
});

test("the real config protects upstream's slug and nothing else by accident", () => {
  assert.ok(Array.isArray(cfg.protect) && cfg.protect.length > 0);
  for (const p of cfg.protect) assert.ok(/superpowers/i.test(p), `${p} is not an upstream-name string`);
});
