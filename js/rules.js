/* Character state + every derived number the sheet shows.
   derive(char) is pure: it reads the character and the loaded DATA and returns
   a fresh object. Nothing here mutates char. */

import { DATA } from './data.js';

export const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STORAGE_KEY = 'dnd24-builder-character-v1';

export function newCharacter() {
  return {
    version: 1,
    name: '',
    level: 1,
    classId: null,
    speciesId: null,
    speciesChoices: {},          // choiceId -> value | value[]
    abilityMethod: 'standard',
    baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    standardAssign: {},          // abilityId -> array index in standardArray
    rolledSet: null,             // number[] once rolled
    rollAssign: {},              // abilityId -> index in rolledSet
    backgroundId: null,
    bgAbility: { mode: '2-1', plus2: null, plus1: null },
    customBg: { abilities: [], feat: null, skills: [], tool: null },
    classSkills: [],
    classChoices: {},            // fightingStyle, weaponMastery[], expertise[], divineOrder, invocation, language, tools[]
    featChoices: {},             // featId -> { cantrips:[], spell, ability, profs:[] }
    equipmentChoice: { class: null, background: 'a' },
    spells: { cantrips: [], prepared: [], spellbook: [] },
    // State that changes during play rather than during character creation.
    // Hit point fields start blank on purpose: on a printed sheet they are
    // boxes the player writes and erases, so nothing is filled in for them.
    play: {
      currentHp: '', tempHp: '', deathSuccess: 0, deathFail: 0, slotsUsed: 0,
      inspiration: false, foundItems: '', notes: '',
      coins: { cp: '', sp: '', ep: '', gp: '', pp: '' }
    },
    notes: ''
  };
}

export const mod = score => Math.floor((score - 10) / 2);
export const fmt = n => (n >= 0 ? `+${n}` : `${n}`);

/* ---------------- persistence ---------------- */

export function save(char) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(char)); } catch { /* private mode */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || c.version !== 1) return null;
    // Merge nested defaults too, so a character saved before a field existed
    // still loads with that field present.
    const base = newCharacter();
    return {
      ...base, ...c,
      play: { ...base.play, ...(c.play || {}), coins: { ...base.play.coins, ...((c.play || {}).coins || {}) } },
      spells: { ...base.spells, ...(c.spells || {}) }
    };
  } catch { return null; }
}
export function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/* ---------------- small helpers ---------------- */

const asArray = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** Resolve the option object a species choice points at. */
function speciesOption(choice, value) {
  return (choice.options || []).find(o => o.id === value) || null;
}

/* ---------------- ability scores ---------------- */

/** Background ability increases, as { abilityId: amount }. */
export function backgroundBonuses(char) {
  const out = {};
  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (!bg) return out;

  const abilities = char.backgroundId === 'custom'
    ? char.customBg.abilities.filter(Boolean)
    : bg.abilities || [];
  if (!abilities.length) return out;

  if (char.bgAbility.mode === '1-1-1') {
    for (const a of abilities) out[a] = (out[a] || 0) + 1;
  } else {
    const { plus2, plus1 } = char.bgAbility;
    if (plus2) out[plus2] = (out[plus2] || 0) + 2;
    if (plus1) out[plus1] = (out[plus1] || 0) + 1;
  }
  return out;
}

export function finalAbilities(char) {
  const bonus = backgroundBonuses(char);
  const out = {};
  for (const a of ABILS) out[a] = Math.min(20, (char.baseAbilities[a] || 10) + (bonus[a] || 0));
  return out;
}

/* ---------------- point buy ---------------- */

export function pointBuyCost(score) {
  const table = DATA.rules.pointBuy.costs;
  return table[String(score)] ?? null;
}
export function pointBuySpent(base) {
  return ABILS.reduce((sum, a) => sum + (pointBuyCost(base[a]) ?? 0), 0);
}

/* ---------------- proficiency collection ---------------- */

/** Every skill proficiency with where it came from.
 *  Returns Map<skillId, { sources: string[], expertise: boolean }> */
export function collectSkills(char) {
  const map = new Map();
  const add = (id, source) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, { sources: [], expertise: false });
    const e = map.get(id);
    if (!e.sources.includes(source)) e.sources.push(source);
  };

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (cls) for (const s of char.classSkills) add(s, cls.name);

  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (bg) {
    const skills = char.backgroundId === 'custom' ? char.customBg.skills : bg.skills || [];
    for (const s of skills) add(s, bg.name);
  }

  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  if (sp) {
    for (const ch of sp.choices || []) {
      if (ch.grant?.type !== 'skill') continue;
      for (const v of asArray(char.speciesChoices[ch.id])) add(v, sp.name);
    }
  }

  // Origin feats that hand out skills (Skilled, and anything shaped like it).
  for (const [featId, picks] of Object.entries(char.featChoices || {})) {
    const feat = DATA.byId.feat[featId];
    if (!feat || !picks) continue;
    for (const v of asArray(picks.profs)) {
      if (DATA.byId.skill[v]) add(v, feat.name);
    }
  }

  // Rogue Expertise
  for (const s of asArray(char.classChoices.expertise)) {
    if (map.has(s)) map.get(s).expertise = true;
  }
  return map;
}

/** Tool proficiencies with sources. */
export function collectTools(char) {
  const out = [];
  const add = (name, source) => { if (name && !out.some(t => t.name === name)) out.push({ name, source }); };

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (cls) {
    if (typeof cls.toolProficiencies === 'string') add(cls.toolProficiencies, cls.name);
    else if (cls.toolProficiencies) for (const t of asArray(char.classChoices.tools)) add(t, cls.name);
  }

  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (bg && char.backgroundId !== 'custom') {
    for (const t of bg.tools || []) {
      if (t.fixed) add(t.fixed, bg.name);
      else add(char.classChoices[`bgTool`] || null, bg.name);
    }
  } else if (bg && char.backgroundId === 'custom') {
    add(char.customBg.tool, bg.name);
  }

  for (const [featId, picks] of Object.entries(char.featChoices || {})) {
    const feat = DATA.byId.feat[featId];
    if (!feat || !picks) continue;
    for (const v of asArray(picks.profs)) {
      if (!DATA.byId.skill[v]) add(v, feat.name);
    }
  }
  return out;
}

/** Every Origin feat the character has, with where it came from. */
export function collectFeats(char) {
  const out = [];
  const add = (id, source) => {
    const f = DATA.byId.feat[id];
    if (f && !out.some(x => x.feat.id === id)) out.push({ feat: f, source });
  };

  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (bg) {
    if (char.backgroundId === 'custom') add(char.customBg.feat, 'Custom Background');
    else add(bg.feat, bg.name);
  }

  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  if (sp) {
    for (const ch of sp.choices || []) {
      if (ch.grant?.type === 'originFeat') add(char.speciesChoices[ch.id], sp.name);
    }
  }

  if (char.classChoices.fightingStyle) add(char.classChoices.fightingStyle, 'Fighting Style');
  return out;
}

/* ---------------- species effects ---------------- */

/** Merge the species' own effects with any chosen option's effects. */
export function speciesEffects(char) {
  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  const eff = { speed: null, darkvision: 0, resistances: [], cantrips: [], hpPerLevel: 0, breathDamage: null, freeSpells: [] };
  if (!sp) return eff;

  const apply = src => {
    if (!src) return;
    if (src.speed != null) eff.speed = src.speed;
    if (src.darkvision != null) eff.darkvision = Math.max(eff.darkvision, src.darkvision);
    for (const r of src.resistances || []) if (!eff.resistances.includes(r)) eff.resistances.push(r);
    for (const c of src.cantrips || []) if (!eff.cantrips.includes(c)) eff.cantrips.push(c);
    for (const s of src.freeSpells || []) if (!eff.freeSpells.includes(s)) eff.freeSpells.push(s);
    if (src.hpPerLevel) eff.hpPerLevel += src.hpPerLevel;
    if (src.breathDamage) eff.breathDamage = src.breathDamage;
  };

  apply(sp.effects);
  for (const ch of sp.choices || []) {
    const opt = speciesOption(ch, char.speciesChoices[ch.id]);
    if (opt) apply(opt.effects);
  }
  if (eff.speed == null) eff.speed = sp.speed;
  return eff;
}

/* ---------------- equipment ---------------- */

export function startingItems(char) {
  const items = [];
  let gp = 0;

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (cls) {
    const pick = (cls.startingEquipment || []).find(o => o.id === char.equipmentChoice.class);
    if (pick) { items.push(...pick.items.map(i => ({ name: i, from: cls.name }))); gp += pick.gp || 0; }
  }

  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (bg && bg.equipment) {
    const pick = bg.equipment[char.equipmentChoice.background];
    if (pick) { items.push(...pick.items.map(i => ({ name: i, from: bg.name }))); gp += pick.gp || 0; }
  }
  return { items, gp };
}

/** Best armor + shield present in the starting gear. */
function wornArmor(items) {
  let armor = null, shield = false;
  for (const it of items) {
    const a = DATA.byId.armor[it.name];
    if (a && (!armor || a.baseAC > armor.baseAC)) armor = a;
    if (/^shield$/i.test(it.name)) shield = true;
  }
  return { armor, shield };
}

/** AC plus a human-readable explanation of how it was reached. */
export function computeAC(char, abilities) {
  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  const { items } = startingItems(char);
  const { armor, shield } = wornArmor(items);
  const dex = mod(abilities.dex);
  const feats = collectFeats(char).map(f => f.feat.id);

  const shieldBonus = shield ? DATA.equipment.shield.acBonus : 0;
  let ac, how;

  if (armor) {
    let fromDex = 0;
    if (armor.addDex) fromDex = armor.dexMax != null ? Math.min(dex, armor.dexMax) : dex;
    ac = armor.baseAC + fromDex;
    how = `${armor.name} (${armor.baseAC}${armor.addDex ? ` ${fmt(fromDex)} Dex` : ''})`;
    if (feats.includes('defense')) { ac += 1; how += ' +1 Defense'; }
  } else {
    // Unarmored Defense from the class, if it has one.
    const udFeature = (cls?.features || []).find(f => f.acFormula);
    const hasMageArmor = char.classChoices.invocation === 'armor-of-shadows';
    if (udFeature) {
      const add = udFeature.acFormula.add.reduce((s, a) => s + mod(abilities[a]), 0);
      ac = udFeature.acFormula.base + add;
      how = `Unarmored Defense (10 ${udFeature.acFormula.add.map(a => fmt(mod(abilities[a])) + ' ' + a.toUpperCase()).join(' ')})`;
      if (!udFeature.acFormula.shieldAllowed && shield) {
        return { ac, how: how + ' — a Shield would switch this off', shield: false, armor: null };
      }
    } else if (hasMageArmor) {
      ac = 13 + dex;
      how = `Mage Armor from Armor of Shadows (13 ${fmt(dex)} Dex)`;
    } else {
      ac = 10 + dex;
      how = `No armor (10 ${fmt(dex)} Dex)`;
    }
  }
  if (shieldBonus) { ac += shieldBonus; how += ` +${shieldBonus} Shield`; }
  return { ac, how, shield, armor };
}

/* ---------------- spells ---------------- */

/** Cantrips and spells granted outside the class's own picks. */
export function bonusSpells(char) {
  const out = [];
  const add = (idOrName, source, kind) => {
    const sp = DATA.byId.spell[idOrName] || DATA.spellsByName[idOrName];
    if (sp && !out.some(x => x.spell.id === sp.id && x.source === source)) out.push({ spell: sp, source, kind });
  };

  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  const eff = speciesEffects(char);
  if (sp) {
    for (const id of eff.cantrips) add(id, sp.name, 'cantrip');
    for (const id of eff.freeSpells) add(id, sp.name, 'free');
  }

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  for (const id of cls?.spellcasting?.alwaysPrepared || []) add(id, cls.name, 'always');

  for (const { feat } of collectFeats(char)) {
    const picks = char.featChoices[feat.id];
    if (!picks) continue;
    for (const c of picks.cantrips || []) add(c, feat.name, 'cantrip');
    if (picks.spell) add(picks.spell, feat.name, 'free');
  }
  return out;
}

/* ---------------- the big one ---------------- */

export function derive(char) {
  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;

  const abilities = finalAbilities(char);
  const mods = Object.fromEntries(ABILS.map(a => [a, mod(abilities[a])]));
  const pb = 2; // level 1
  const eff = speciesEffects(char);

  const feats = collectFeats(char);
  const featIds = feats.map(f => f.feat.id);

  // Per-level hit point bonuses stack: Dwarven Toughness gives +1/level and the
  // Tough feat gives +2/level, and a Dwarf with Tough gets both.
  const hpPerLevel = (eff.hpPerLevel || 0)
    + feats.reduce((sum, f) => sum + (f.feat.effects?.hpPerLevel || 0), 0);

  const hp = cls ? cls.hitDie + mods.con + hpPerLevel * char.level : 0;
  const acInfo = computeAC(char, abilities);

  const initiative = mods.dex + (featIds.includes('alert') ? pb : 0);

  const skillMap = collectSkills(char);
  const skills = DATA.rules.skills.map(s => {
    const entry = skillMap.get(s.id);
    const times = entry ? (entry.expertise ? 2 : 1) : 0;
    return {
      ...s,
      proficient: !!entry,
      expertise: !!entry?.expertise,
      sources: entry?.sources || [],
      mod: mods[s.ability] + pb * times
    };
  });

  const saves = ABILS.map(a => ({
    id: a,
    name: DATA.byId.ability[a].name,
    proficient: !!cls && cls.savingThrows.includes(a),
    mod: mods[a] + (cls && cls.savingThrows.includes(a) ? pb : 0)
  }));

  let spellcasting = null;
  if (cls?.spellcasting) {
    const sc = cls.spellcasting;
    const bonusCantrips = (() => {
      // Cleric Divine Order / Druid Primal Order can add a cantrip.
      for (const f of cls.features || []) {
        const opt = (f.choice?.options || []).find(o => o.id === char.classChoices[f.choice?.id]);
        if (opt?.effects?.bonusCantrips) return opt.effects.bonusCantrips;
      }
      return 0;
    })();
    const abilityMod = mods[sc.ability];
    spellcasting = {
      ...sc,
      cantripsKnown: sc.cantripsKnown + bonusCantrips,
      abilityMod,
      saveDC: 8 + pb + abilityMod,
      attackBonus: pb + abilityMod,
      abilityName: DATA.byId.ability[sc.ability].name
    };
  }

  const { items, gp } = startingItems(char);

  // Attack lines for any weapon in the starting gear.
  const attacks = [];
  const masteries = asArray(char.classChoices.weaponMastery);
  for (const it of items) {
    const base = it.name.replace(/^\d+\s+/, '').replace(/s$/, '');
    const w = DATA.byId.weapon[it.name] || DATA.byId.weapon[base]
      || DATA.equipment.weapons.find(x => it.name.toLowerCase().includes(x.name.toLowerCase()));
    if (!w || attacks.some(a => a.name === w.name)) continue;
    const finesse = w.properties.some(p => /Finesse/i.test(p));
    const ranged = w.range === 'ranged';
    const useDex = ranged || (finesse && mods.dex > mods.str);
    let abil = useDex ? 'dex' : 'str';
    // Monk Martial Arts and Warlock Pact of the Blade change the attacking ability.
    if (cls?.id === 'monk' && (w.category === 'simple' || w.properties.some(p => /Light/i.test(p))) && w.range === 'melee') abil = mods.dex >= mods.str ? 'dex' : 'str';
    if (char.classChoices.invocation === 'pact-of-the-blade' && w.range === 'melee') abil = 'cha';

    const proficient = true; // level 1 starting gear is always something the class can use
    let atk = mods[abil] + (proficient ? pb : 0);
    if (featIds.includes('archery') && ranged) atk += 2;
    attacks.push({
      name: w.name,
      atk,
      damage: `${w.damage} ${fmt(mods[abil])}`.replace(' +0', ''),
      damageType: w.damageType,
      ability: abil.toUpperCase(),
      properties: w.properties,
      mastery: masteries.includes(w.name) ? DATA.byId.mastery[w.mastery] : null
    });
  }

  return {
    cls, sp, bg,
    abilities, mods, pb,
    hp, hitDie: cls ? `1d${cls.hitDie}` : '—',
    ac: acInfo.ac, acHow: acInfo.how,
    initiative,
    speed: eff.speed || 30,
    darkvision: eff.darkvision,
    resistances: eff.resistances,
    size: sizeOf(char, sp),
    skills, saves, spellcasting,
    feats,
    tools: collectTools(char),
    items, gp,
    attacks,
    bonusSpells: bonusSpells(char),
    masteries: masteries.map(n => ({ weapon: n, mastery: DATA.byId.mastery[DATA.byId.weapon[n]?.mastery] })).filter(m => m.mastery),
    passivePerception: 10 + (skills.find(s => s.id === 'perception')?.mod ?? mods.wis)
  };
}

function sizeOf(char, sp) {
  if (!sp) return '—';
  if (sp.size.fixed) return sp.size.fixed;
  return char.speciesChoices.size || sp.size.choice[0];
}

/* ---------------- step completeness ---------------- */

/** Returns [] when the step is done, otherwise a list of what is missing. */
export function stepIssues(char, stepId) {
  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  const out = [];

  switch (stepId) {
    case 'class':
      if (!cls) out.push('Pick a class');
      break;

    case 'species': {
      if (!sp) { out.push('Pick a species'); break; }
      if (sp.size.choice && !char.speciesChoices.size) out.push('Choose your size');
      for (const ch of sp.choices || []) {
        const v = char.speciesChoices[ch.id];
        const need = ch.grant?.count || 1;
        if (asArray(v).filter(Boolean).length < need) out.push(ch.label);
      }
      break;
    }

    case 'abilities': {
      const base = char.baseAbilities;
      if (ABILS.some(a => !base[a])) out.push('Set all six ability scores');
      if (char.abilityMethod === 'pointbuy') {
        const spent = pointBuySpent(base);
        if (spent > DATA.rules.pointBuy.budget) out.push(`You are ${spent - DATA.rules.pointBuy.budget} points over budget`);
      }
      if (char.abilityMethod === 'standard') {
        const used = Object.values(char.standardAssign).filter(v => v !== undefined && v !== null);
        if (used.length < 6) out.push('Assign all six numbers');
      }
      if (char.abilityMethod === 'roll') {
        if (!char.rolledSet) out.push('Roll your scores');
        else if (Object.values(char.rollAssign).filter(v => v != null).length < 6) out.push('Assign all six rolls');
      }
      break;
    }

    case 'background': {
      if (!bg) { out.push('Pick a background'); break; }
      if (char.backgroundId === 'custom') {
        if (char.customBg.abilities.filter(Boolean).length < 3) out.push('Choose three abilities');
        if (!char.customBg.feat) out.push('Choose an Origin feat');
        if (char.customBg.skills.filter(Boolean).length < 2) out.push('Choose two skills');
        if (!char.customBg.tool) out.push('Choose a tool');
      }
      if (char.bgAbility.mode === '2-1') {
        if (!char.bgAbility.plus2) out.push('Choose which ability gets +2');
        if (!char.bgAbility.plus1) out.push('Choose which ability gets +1');
        if (char.bgAbility.plus2 && char.bgAbility.plus2 === char.bgAbility.plus1) out.push('The +2 and +1 must go to different abilities');
      }
      break;
    }

    case 'proficiencies': {
      if (!cls) { out.push('Pick a class first'); break; }
      const want = cls.skills.count;
      if (char.classSkills.length !== want) out.push(`Choose ${want} class skill${want > 1 ? 's' : ''} (${char.classSkills.length} chosen)`);

      for (const f of cls.features || []) {
        const ch = f.choice;
        if (!ch) continue;
        const v = char.classChoices[ch.id];
        const need = ch.grant?.count || 1;
        if (asArray(v).filter(Boolean).length < need) out.push(ch.label);
      }
      for (const f of cls.extraFeatures || []) {
        const ch = f.choice;
        if (!ch) continue;
        if (asArray(char.classChoices[ch.id]).filter(Boolean).length < (ch.grant?.count || 1)) out.push(ch.label);
      }
      if (cls.toolProficiencies && typeof cls.toolProficiencies === 'object') {
        if (asArray(char.classChoices.tools).filter(Boolean).length < cls.toolProficiencies.count) out.push(cls.toolProficiencies.label);
      }
      // Background tool that needs a pick
      if (bg && char.backgroundId !== 'custom') {
        for (const t of bg.tools || []) {
          if (t.chooseFrom && !char.classChoices.bgTool) out.push(t.label);
        }
      }
      // Feats that need picks
      for (const { feat } of collectFeats(char)) {
        for (const ch of feat.choices || []) {
          const picks = char.featChoices[feat.id] || {};
          const need = ch.grant?.count || 1;
          let got = 0;
          if (ch.grant.type === 'spell') got = asArray(ch.grant.spellLevel === 0 ? picks.cantrips : picks.spell).filter(Boolean).length;
          else if (ch.grant.type === 'ability') got = picks.ability ? 1 : 0;
          else got = asArray(picks.profs).filter(Boolean).length;
          if (got < need) out.push(`${feat.name}: ${ch.label}`);
        }
      }
      if (!char.equipmentChoice.class) out.push('Choose your starting equipment');
      break;
    }

    case 'spells': {
      if (!cls?.spellcasting) break;
      const d = derive(char);
      const sc = d.spellcasting;
      if (char.spells.cantrips.length !== sc.cantripsKnown) {
        out.push(`Choose ${sc.cantripsKnown} cantrip${sc.cantripsKnown > 1 ? 's' : ''} (${char.spells.cantrips.length} chosen)`);
      }
      if (sc.prepareStyle === 'spellbook') {
        if (char.spells.spellbook.length !== sc.spellbookSpells) {
          out.push(`Write ${sc.spellbookSpells} spells in your spellbook (${char.spells.spellbook.length} written)`);
        }
        if (char.spells.prepared.length !== sc.preparedSpells) {
          out.push(`Prepare ${sc.preparedSpells} of them (${char.spells.prepared.length} prepared)`);
        }
      } else if (char.spells.prepared.length !== sc.preparedSpells) {
        out.push(`Choose ${sc.preparedSpells} level 1 spell${sc.preparedSpells > 1 ? 's' : ''} (${char.spells.prepared.length} chosen)`);
      }
      break;
    }
  }
  return out;
}
