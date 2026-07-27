import { classify, reconcile } from "./classify.mjs";
import { renameText, renamePath } from "./rename.mjs";
import { parsePatch, applyPatch } from "./patch.mjs";

const UPSTREAM_NAME = /[A-Za-z0-9_./-]*superpowers[A-Za-z0-9_./-]*/gi;

function maskProtected(text, protect) {
  let out = text;
  for (const p of [...(protect ?? [])].sort((a, b) => b.length - a.length)) out = out.split(p).join("");
  return out;
}

function applyDelta(files, delta) {
  const parsed = parsePatch(delta.text);
  if (!parsed.length) return { outcome: "failed", detail: `${delta.name} contains no hunks` };
  const texts = new Map([...files].map(([p, f]) => [p, f.text]));
  const results = parsed.map((p) => applyPatch(texts, p));
  const broken = results.find((r) => r.outcome === "failed");
  if (broken) return { outcome: "failed", detail: broken.detail };
  for (const r of results) files.set(r.path, { ...files.get(r.path), text: r.content });
  return { outcome: results.every((r) => r.outcome === "obsolete") ? "obsolete" : "applied" };
}

function checkAttribution(files, tree, cfg) {
  const missing = [];
  for (const req of cfg.attribution?.require ?? []) {
    const out = files.get(req.path);
    if (!out) {
      missing.push({ path: req.path, reason: req.reason, detail: `${req.path} is not in the built tree at all` });
      continue;
    }
    if (req.verbatimFrom) {
      const source = tree.get(req.verbatimFrom);
      if (!source || source.text !== out.text) {
        missing.push({ path: req.path, reason: req.reason, detail: `${req.path} is not byte-identical to upstream's ${req.verbatimFrom}` });
      }
    }
    const absent = (req.contains ?? []).filter((s) => !out.text.includes(s));
    if (absent.length) {
      missing.push({ path: req.path, reason: req.reason, detail: `${req.path} is missing required attribution: ${absent.join(", ")}` });
    }
  }
  return missing;
}

export function build({ tree, cfg, inventory, forkOwned, deltas = [] }) {
  const mapDrift = reconcile({ paths: [...tree.keys()], rules: inventory.rules, manifest: inventory.manifest });

  const files = new Map();
  for (const [rel, entry] of tree) {
    const rule = classify(rel, inventory.rules);
    if (rule?.class !== "tracked") continue;
    const verbatim = rule.mode === "verbatim";
    const outRel = verbatim ? rel : renamePath(rel, cfg);
    const text = verbatim ? entry.text : renameText(entry.text, cfg);
    files.set(`${inventory.pluginRoot}/${outRel}`, { mode: entry.mode, text });
    if (rule.alsoAtRoot) files.set(outRel, { mode: entry.mode, text });
  }

  for (const f of inventory.forkOwned ?? []) {
    const text = forkOwned?.get(f.src);
    if (text === undefined) throw new Error(`fork-owned file missing from the patch branch: ${f.src}`);
    files.set(f.dest, { mode: "100644", text });
  }

  const applied = [], obsolete = [], failed = [], failures = [];
  for (const delta of deltas) {
    const r = applyDelta(files, delta);
    if (r.outcome === "applied") applied.push(delta.name);
    else if (r.outcome === "obsolete") obsolete.push(delta.name);
    else { failed.push(delta.name); failures.push({ name: delta.name, detail: r.detail }); }
  }

  const residual = [];
  for (const [path, entry] of files) {
    for (const m of maskProtected(entry.text, cfg.protect).matchAll(UPSTREAM_NAME)) residual.push({ path, text: m[0] });
  }

  return {
    files: new Map([...files].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))),
    mapDrift,
    applied,
    obsolete,
    failed,
    failures,
    attributionMissing: checkAttribution(files, tree, cfg),
    residual,
  };
}
