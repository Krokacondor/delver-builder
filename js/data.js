/* Loads every data file once and exposes it as DATA.
   data/extras.json is optional: if present it merges in extra species,
   backgrounds, feats and spells (e.g. Player's Handbook content kept out of
   the public repo). A missing extras.json is not an error. */

export const DATA = {};

const FILES = ['rules', 'classes', 'species', 'backgrounds', 'feats', 'equipment', 'spells'];

// Resolve data files against this module's own URL, so the app works from any
// page depth and from a GitHub Pages project subpath, not just from the root.
const dataURL = name => new URL('../data/' + name, import.meta.url).href;

async function getJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return res.json();
}

/** Merge an extras file into the loaded core data. Extras never remove core entries;
 *  an extra with an id that already exists replaces that entry. */
function mergeExtras(extras) {
  const mergeList = (targetObj, key, incoming, idKey = 'id') => {
    if (!Array.isArray(incoming) || !incoming.length) return 0;
    const list = targetObj[key];
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const item of incoming) {
      const i = list.findIndex(x => x[idKey] === item[idKey]);
      if (i >= 0) list[i] = item; else list.push(item);
      n++;
    }
    return n;
  };

  const added = {};
  added.species = mergeList(DATA.species, 'species', extras.species);
  added.backgrounds = mergeList(DATA.backgrounds, 'backgrounds', extras.backgrounds);
  added.feats = mergeList(DATA.feats, 'feats', extras.feats);
  added.classes = mergeList(DATA.classes, 'classes', extras.classes);
  added.spells = mergeList(DATA.spells, 'spells', extras.spells);

  // Extra spells also need to join the relevant class spell lists.
  if (Array.isArray(extras.spells)) {
    for (const sp of extras.spells) {
      for (const cls of sp.classes || []) {
        const key = cls.toLowerCase();
        const list = DATA.spells.classLists[key];
        if (list && !list.includes(sp.name)) list.push(sp.name);
      }
    }
  }
  DATA.extrasLoaded = Object.entries(added).filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`).join(', ');
}

/** Populate DATA from already-parsed files and build the lookup indexes.
 *  Split out from loadData so tests can feed it from disk instead of fetch. */
export function initData(files, extras) {
  for (const f of FILES) DATA[f] = files[f];
  if (extras) mergeExtras(extras);
  buildIndexes();
  return DATA;
}

export async function loadData() {
  const loaded = await Promise.all(FILES.map(f => getJSON(dataURL(`${f}.json`))));
  FILES.forEach((f, i) => { DATA[f] = loaded[i]; });

  // Optional local extras. Absent file, bad JSON or offline: ignore quietly.
  try {
    const res = await fetch(dataURL('extras.json'), { cache: 'no-cache' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      // A 404 handler can return an HTML page with status 200; only accept real JSON.
      if (ct.includes('json')) mergeExtras(await res.json());
    }
  } catch { /* no extras, fine */ }

  buildIndexes();
  return DATA;
}

function buildIndexes() {
  DATA.byId = {
    class:      Object.fromEntries(DATA.classes.classes.map(c => [c.id, c])),
    species:    Object.fromEntries(DATA.species.species.map(s => [s.id, s])),
    background: Object.fromEntries(DATA.backgrounds.backgrounds.map(b => [b.id, b])),
    feat:       Object.fromEntries(DATA.feats.feats.map(f => [f.id, f])),
    spell:      Object.fromEntries(DATA.spells.spells.map(s => [s.id, s])),
    skill:      Object.fromEntries(DATA.rules.skills.map(s => [s.id, s])),
    ability:    Object.fromEntries(DATA.rules.abilities.map(a => [a.id, a])),
    armor:      Object.fromEntries(DATA.equipment.armor.map(a => [a.name, a])),
    weapon:     Object.fromEntries(DATA.equipment.weapons.map(w => [w.name, w])),
    mastery:    Object.fromEntries(DATA.equipment.masteryProperties.map(m => [m.id, m])),
    pack:       Object.fromEntries(DATA.equipment.packs.map(p => [p.name, p]))
  };
  DATA.byId.background.custom = DATA.backgrounds.custom;
  DATA.spellsByName = Object.fromEntries(DATA.spells.spells.map(s => [s.name, s]));
  DATA.originFeats = DATA.feats.feats.filter(f => f.category === 'origin');
  DATA.fightingStyles = DATA.feats.feats.filter(f => f.category === 'fightingStyle');
}

/** All spells available to a class list, optionally filtered by spell level. */
export function spellsFor(listName, level) {
  const names = DATA.spells.classLists[listName] || [];
  const out = [];
  for (const n of names) {
    const sp = DATA.spellsByName[n];
    if (!sp) continue;
    if (level !== undefined && sp.level !== level) continue;
    out.push(sp);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
