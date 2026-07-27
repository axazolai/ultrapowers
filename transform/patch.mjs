const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function stripPrefix(p) {
  return p.replace(/^[ab]\//, "").replace(/\t.*$/, "").trim();
}

export function parsePatch(text) {
  const files = [];
  let file = null;
  let hunk = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("--- ")) {
      file = null;
      hunk = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      file = { path: stripPrefix(line.slice(4)), hunks: [] };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    const m = HUNK.exec(line);
    if (m) {
      hunk = {
        oldStart: Number(m[1]),
        oldLines: m[2] === undefined ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newLines: m[4] === undefined ? 1 : Number(m[4]),
        lines: [],
      };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    if (line.startsWith("\\")) continue;
    const op = line[0];
    if (op === " " || op === "-" || op === "+") hunk.lines.push({ op, text: line.slice(1) });
  }
  for (const f of files) for (const h of f.hunks) assertGeometry(f.path, h);
  return files;
}

function assertGeometry(path, hunk) {
  const before = hunk.lines.filter((l) => l.op !== "+").length;
  const after = hunk.lines.filter((l) => l.op !== "-").length;
  if (before !== hunk.oldLines || after !== hunk.newLines) {
    throw new Error(
      `malformed hunk at ${path}:${hunk.oldStart} - header declares ${hunk.oldLines}/${hunk.newLines} lines, body has ${before}/${after}. `
      + "A blank context line stripped of its leading space is the usual cause; the delta must be re-exported.",
    );
  }
}

function findSequence(lines, seq, expected) {
  if (!seq.length) return expected >= 0 && expected <= lines.length ? expected : -1;
  let best = -1;
  for (let i = 0; i + seq.length <= lines.length; i += 1) {
    let ok = true;
    for (let j = 0; j < seq.length; j += 1) {
      if (lines[i + j] !== seq[j]) { ok = false; break; }
    }
    if (!ok) continue;
    if (best === -1 || Math.abs(i - expected) < Math.abs(best - expected)) best = i;
  }
  return best;
}

export function applyPatch(files, file) {
  if (!files.has(file.path)) {
    return { path: file.path, outcome: "failed", detail: `no such file in the build tree: ${file.path}` };
  }
  const source = files.get(file.path);
  let lines = source.split("\n");
  let offset = 0;
  let appliedHunks = 0;
  let obsoleteHunks = 0;

  for (const hunk of file.hunks) {
    const before = hunk.lines.filter((l) => l.op !== "+").map((l) => l.text);
    const after = hunk.lines.filter((l) => l.op !== "-").map((l) => l.text);
    const expected = hunk.oldStart - 1 + offset;
    const at = findSequence(lines, before, expected);
    if (at !== -1) {
      lines.splice(at, before.length, ...after);
      offset += after.length - before.length;
      appliedHunks += 1;
      continue;
    }
    if (findSequence(lines, after, expected) !== -1) {
      obsoleteHunks += 1;
      offset += after.length - before.length;
      continue;
    }
    return {
      path: file.path,
      outcome: "failed",
      detail: `context not found at ~line ${hunk.oldStart} of ${file.path}; upstream changed it and the delta needs re-authoring`,
    };
  }

  const outcome = appliedHunks === 0 ? "obsolete" : "applied";
  return { path: file.path, outcome, content: lines.join("\n"), appliedHunks, obsoleteHunks };
}
