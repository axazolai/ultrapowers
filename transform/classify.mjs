const PREFIX_GLOB = /\/\*\*$/;

export function matchRule(path, rule) {
  const pattern = rule.match;
  if (PREFIX_GLOB.test(pattern)) return path.startsWith(pattern.slice(0, -2));
  if (pattern.includes("*")) throw new Error(`unsupported pattern "${pattern}": only an exact path or a trailing /** is understood`);
  return path === pattern;
}

export function classify(path, rules) {
  for (const rule of rules) if (matchRule(path, rule)) return rule;
  return null;
}

export function reconcile({ paths, rules, manifest }) {
  const seen = new Set(paths);
  const tracked = [], ignored = [], added = [], unclassified = [];
  for (const path of [...paths].sort()) {
    const rule = classify(path, rules);
    if (!rule) { unclassified.push(path); continue; }
    if (!(path in manifest)) added.push({ path, proposed: rule.class, reason: rule.reason });
    (rule.class === "tracked" ? tracked : ignored).push(path);
  }
  const removed = Object.keys(manifest).filter((p) => !seen.has(p)).sort();
  const reclassified = [...seen]
    .filter((p) => p in manifest)
    .map((p) => ({ path: p, was: manifest[p], now: classify(p, rules)?.class }))
    .filter((e) => e.now && e.was !== e.now)
    .sort((a, b) => a.path.localeCompare(b.path));
  return { tracked, ignored, added, removed, unclassified, reclassified };
}

export function assertReasoned(rules) {
  const bad = rules.filter((r) => !r.reason || r.reason.length <= 10).map((r) => r.match);
  if (bad.length) throw new Error(`rules without a usable reason: ${bad.join(", ")}`);
}
