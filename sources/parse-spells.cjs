const fs = require('fs');

const tidy = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];


const raw = fs.readFileSync(process.argv[2], 'utf8');
const allLines = raw.split('\n');

// ---------- Pass 1: canonical spell names + class lists from the per-class spell list tables ----------
const canonical = new Map();   // NORMALIZEDNAME -> proper name
const classLists = {};         // class -> Set of spell names
CLASSES.forEach(c => (classLists[c] = new Set()));

const norm = s => s.toUpperCase().replace(/[^A-Z]/g, '');

{
  let curClass = null, curLevel = null;
  for (const line0 of allLines) {
    const line = line0.trim();
    if (/^===== PAGE/.test(line) || /^System Reference Document/.test(line)) continue;

    let m = line.match(/^(Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Warlock|Wizard) Spell List$/);
    if (m) { curClass = m[1]; curLevel = null; continue; }
    if (/Subclass:/.test(line) || /^Core .* Traits$/.test(line)) { curClass = null; continue; }
    if (!curClass) continue;

    m = line.match(/^Cantrips \(Level 0 .* Spells\)$/);
    if (m) { curLevel = 0; continue; }
    m = line.match(/^Level (\d) .* Spells$/);
    if (m) { curLevel = +m[1]; continue; }
    if (curLevel === null) continue;
    if (/^Spell School Special$/.test(line)) continue;

    // "Comprehend Languages Divination R"  /  "Aid Abjuration —"  /  "Minor Illusion Illusion —"
    // Name is greedy so a spell whose name ends in a school word ("Minor Illusion") is not truncated;
    // the Special column is anchored to the end of the line to keep the split unambiguous.
    m = line.match(/^(.+)\s+(Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation)\s+([—–-]|[CRM](?:,\s*[CRM])*)$/);
    if (m) {
      const name = m[1].trim();
      if (!/^[A-Z]/.test(name)) continue;
      canonical.set(norm(name), tidy(name));
      classLists[curClass].add(tidy(name));
    }
  }
}

// ---------- Pass 2: spell descriptions ----------
const startIdx = allLines.findIndex(l => l.trim() === 'Spell Descriptions');
const endIdx = allLines.findIndex((l, i) => i > startIdx && l.trim() === 'Rules Glossary');
const body = allLines.slice(startIdx + 1, endIdx > 0 ? endIdx : undefined)
  .filter(l => !/^===== PAGE/.test(l) && !/^System Reference Document/.test(l));

const schoolAlt = SCHOOLS.join('|');
const headerRe = new RegExp(`^(?:Level (\\d) (${schoolAlt})|(${schoolAlt}) Cantrip)\\s*(?:\\(([^)]*)\\))?`, 'i');

// Find each header line; the spell name is the nearest preceding non-empty line.
const starts = [];
for (let i = 0; i < body.length; i++) {
  const t = body[i].trim();
  const m = t.match(headerRe);
  if (!m) continue;
  let j = i - 1;
  while (j >= 0 && body[j].trim() === '') j--;
  if (j < 0) continue;
  starts.push({ nameIdx: j, headIdx: i, m });
}

const dehyphen = arr =>
  arr.join('\n')
     .replace(/([a-zA-Z])-\n([a-z])/g, '$1$2')
     .replace(/\n/g, ' ')
     .replace(/\s+/g, ' ')
     .trim();

const slug = s => tidy(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const spells = [];
const unmatched = [];

for (let s = 0; s < starts.length; s++) {
  const cur = starts[s];
  const next = starts[s + 1];
  const rawName = body[cur.nameIdx].trim();
  const key = norm(rawName);
  let name = canonical.get(key);
  if (!name) {
    // Not on any class list (e.g. a spell only granted by a feature). Best-effort title case.
    name = rawName.replace(/\s+/g, ' ');
    unmatched.push(rawName);
  }

  const m = cur.m;
  const level = m[1] !== undefined && m[1] !== null ? +m[1] : 0;
  const school = (m[2] || m[3]);
  const classesStr = m[4] || '';

  // Header may wrap onto following lines before "Casting Time:".
  let k = cur.headIdx;
  let headerBlob = body[k].trim();
  while (k + 1 < body.length && !/^Casting Time:/.test(body[k + 1].trim())) {
    k++;
    headerBlob += ' ' + body[k].trim();
    if (k - cur.headIdx > 4) break;
  }
  const clsMatch = headerBlob.match(/\(([^)]*)\)/);
  const classes = clsMatch
    ? clsMatch[1].split(',').map(x => x.trim()).filter(x => CLASSES.includes(x))
    : [];

  const endIdx2 = next ? next.nameIdx : body.length;
  const block = body.slice(cur.headIdx, endIdx2);

  const field = label => {
    const idx = block.findIndex(l => new RegExp('^' + label + ':').test(l.trim()));
    if (idx < 0) return null;
    let val = block[idx].trim().replace(new RegExp('^' + label + ':\\s*'), '');
    // value may wrap
    let j = idx + 1;
    while (j < block.length) {
      const t = block[j].trim();
      if (/^(Casting Time|Range|Components|Duration):/.test(t) || t === '') break;
      if (/^[A-Z]/.test(t) && val.endsWith(')')) break;
      if (!/^(V|S|M|\()/.test(t) && label !== 'Components') break;
      val += ' ' + t;
      j++;
    }
    return val.replace(/\s+/g, ' ').trim();
  };

  const castingTime = field('Casting Time');
  const range = field('Range');
  const components = field('Components');
  const duration = field('Duration');

  const durIdx = block.findIndex(l => /^Duration:/.test(l.trim()));
  let descLines = durIdx >= 0 ? block.slice(durIdx + 1) : [];
  // drop the trailing spell-name line of the next entry if captured
  let desc = dehyphen(descLines);

  // Split out the upcast / cantrip-upgrade rider
  let higher = null;
  const hm = desc.match(/(Using a Higher-Level Spell Slot\.|Cantrip Upgrade\.)\s*(.*)$/);
  if (hm) {
    higher = hm[2].trim();
    desc = desc.slice(0, hm.index).trim();
  }

  const concentration = /^Concentration/i.test(duration || '');
  const ritual = /Ritual/i.test(castingTime || '');
  const material = /\bM\b/.test(components || '');

  spells.push({
    id: slug(name),
    name: tidy(name),
    level,
    school,
    classes,
    castingTime,
    range,
    components,
    duration,
    concentration,
    ritual,
    material,
    description: tidy(desc),
    higherLevel: higher ? tidy(higher) : null
  });
}

// ---------- Cross-check: reconcile the class list tables with each spell's own class tags ----------
// The two disagree in a few places in the SRD (e.g. Phantasmal Force has class tags but is absent
// from the list tables), so merge in both directions and let the union win.
const byName = new Map(spells.map(s => [s.name, s]));
for (const c of CLASSES) {
  for (const n of classLists[c]) {
    const sp = byName.get(n);
    if (sp && !sp.classes.includes(c)) sp.classes.push(c);
  }
}
for (const sp of spells) {
  for (const c of sp.classes) classLists[c].add(sp.name);
}
for (const sp of spells) sp.classes.sort();

spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

const out = {
  note: 'Spell text from SRD 5.2.1 (CC-BY-4.0).',
  counts: {},
  classLists: Object.fromEntries(CLASSES.map(c => [c.toLowerCase(), [...classLists[c]].sort()])),
  spells
};
for (const s of spells) out.counts['level' + s.level] = (out.counts['level' + s.level] || 0) + 1;

fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log('parsed spells:', spells.length);
console.log('by level:', JSON.stringify(out.counts));
console.log('class list sizes:', CLASSES.map(c => c + '=' + classLists[c].size).join(' '));
if (unmatched.length) console.log('names not on any class list (' + unmatched.length + '):', unmatched.slice(0, 40).join(' | '));
const noClass = spells.filter(s => s.classes.length === 0);
if (noClass.length) console.log('spells with no class tag (' + noClass.length + '):', noClass.map(s => s.name).slice(0, 30).join(' | '));
const bad = spells.filter(s => !s.castingTime || !s.range || !s.duration || !s.description);
if (bad.length) console.log('INCOMPLETE (' + bad.length + '):', bad.map(s => s.name).slice(0, 30).join(' | '));
