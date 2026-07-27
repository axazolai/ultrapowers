const NUL = String.fromCharCode(0);
const compiled = new WeakMap();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function substitution(subs) {
  let c = compiled.get(subs);
  if (!c) {
    const ordered = [...subs].sort((a, b) => b.from.length - a.from.length);
    c = {
      re: new RegExp(ordered.map((s) => escapeRe(s.from)).join("|"), "g"),
      map: new Map(ordered.map((s) => [s.from, s.to])),
    };
    compiled.set(subs, c);
  }
  return c;
}

function apply(input, cfg) {
  const protect = [...(cfg.protect ?? [])].sort((a, b) => b.length - a.length);
  const marks = [];
  let out = input;
  protect.forEach((p, i) => {
    const token = `${NUL}${i}${NUL}`;
    out = out.split(p).join(token);
    marks.push([token, p]);
  });
  const { re, map } = substitution(cfg.substitutions);
  out = out.replace(re, (m) => map.get(m));
  for (const [token, original] of marks.reverse()) out = out.split(token).join(original);
  return out;
}

export function renameText(text, cfg) {
  if (text.includes(NUL)) throw new Error("NUL byte in input: renameText takes text only, and NUL delimits the protection mask");
  return apply(text, cfg);
}

export function renamePath(relPath, cfg) {
  return apply(relPath, cfg);
}
