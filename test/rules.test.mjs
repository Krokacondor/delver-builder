/* Verifies the derived character math against hand-checked SRD values.
   Run: node test/rules.test.mjs   (from the project root) */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initData, DATA } from '../js/data.js';
import { newCharacter, derive, stepIssues, mod, finalAbilities, pointBuySpent, ABILS } from '../js/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['rules', 'classes', 'species', 'backgrounds', 'feats', 'equipment', 'spells'];
const files = Object.fromEntries(FILES.map(f =>
  [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${f}.json`), 'utf8'))]));
initData(files);

let pass = 0, fail = 0;
const results = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; results.push(['ok', name]); }
  else { fail++; results.push(['FAIL', `${name}\n      expected ${e}\n      actual   ${a}`]); }
}
function ok(name, cond, detail = '') {
  if (cond) { pass++; results.push(['ok', name]); }
  else { fail++; results.push(['FAIL', `${name}${detail ? '\n      ' + detail : ''}`]); }
}

/* ---------- ability modifier table ---------- */
check('mod(8)', mod(8), -1);
check('mod(10)', mod(10), 0);
check('mod(11)', mod(11), 0);
check('mod(15)', mod(15), 2);
check('mod(16)', mod(16), 3);
check('mod(20)', mod(20), 5);

/* ---------- point buy ---------- */
check('point buy: all 8s costs 0', pointBuySpent({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }), 0);
check('point buy: standard-ish spread costs 27',
  pointBuySpent({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }), 27);

/* ---------- helper to build a finished character ---------- */
function build(over = {}) {
  const c = { ...newCharacter(), ...over };
  return c;
}

/* =========================================================
   Fighter / Human / Soldier — the classic beginner build
   ========================================================= */
{
  const c = build({
    name: 'Test Fighter',
    classId: 'fighter',
    speciesId: 'human',
    speciesChoices: { size: 'Medium', skillful: 'perception', versatile: 'skilled' },
    abilityMethod: 'standard',
    baseAbilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    standardAssign: { str: 0, dex: 2, con: 1, int: 5, wis: 3, cha: 4 },
    backgroundId: 'soldier',
    bgAbility: { mode: '2-1', plus2: 'str', plus1: 'con' },
    classSkills: ['athletics', 'survival'],
    classChoices: { fightingStyle: 'defense', weaponMastery: ['Greatsword', 'Flail', 'Javelin'], bgTool: 'Dice Set' },
    featChoices: { skilled: { profs: ['acrobatics', 'insight', 'medicine'] } },
    equipmentChoice: { class: 'A', background: 'a' }
  });

  const d = derive(c);
  check('Fighter: STR 15 +2 background = 17', d.abilities.str, 17);
  check('Fighter: CON 14 +1 background = 15', d.abilities.con, 15);
  check('Fighter: STR mod +3', d.mods.str, 3);
  check('Fighter: CON mod +2', d.mods.con, 2);
  check('Fighter: HP = 10 + 2', d.hp, 12);
  // Chain Mail 16, no Dex, +1 from Defense fighting style
  check('Fighter: AC = Chain Mail 16 +1 Defense', d.ac, 17);
  ok('Fighter: AC explanation names Chain Mail and Defense',
    /Chain Mail/.test(d.acHow) && /Defense/.test(d.acHow), d.acHow);
  check('Fighter: initiative = DEX +1', d.initiative, 1);
  check('Fighter: proficiency bonus', d.pb, 2);

  const athletics = d.skills.find(s => s.id === 'athletics');
  check('Fighter: Athletics = STR 3 + PB 2', athletics.mod, 5);
  ok('Fighter: Athletics sourced to the class', athletics.sources.includes('Fighter'), JSON.stringify(athletics.sources));

  const acro = d.skills.find(s => s.id === 'acrobatics');
  ok('Fighter: Skilled feat grants Acrobatics', acro.proficient, JSON.stringify(acro.sources));

  const perception = d.skills.find(s => s.id === 'perception');
  ok('Fighter: Human Skillful grants Perception', perception.proficient, JSON.stringify(perception.sources));
  check('Fighter: passive Perception = 10 + 1 + 2', d.passivePerception, 13);

  const strSave = d.saves.find(s => s.id === 'str');
  check('Fighter: STR save = 3 + 2', strSave.mod, 5);
  const dexSave = d.saves.find(s => s.id === 'dex');
  check('Fighter: DEX save not proficient', dexSave.mod, 1);

  check('Fighter: no spellcasting', d.spellcasting, null);

  const gs = d.attacks.find(a => a.name === 'Greatsword');
  ok('Fighter: greatsword attack exists', !!gs);
  check('Fighter: greatsword to-hit = STR 3 + PB 2', gs.atk, 5);
  check('Fighter: greatsword damage', gs.damage, '2d6 +3');
  ok('Fighter: greatsword mastery is Graze', gs.mastery?.name === 'Graze', JSON.stringify(gs.mastery));

  check('Fighter: two origin feats (Savage Attacker + Skilled) plus Defense',
    d.feats.map(f => f.feat.id).sort(), ['defense', 'savage-attacker', 'skilled']);

  ok('Fighter: every step complete',
    STEPS_ALL_CLEAR(c), JSON.stringify(ALL_ISSUES(c)));
}

/* =========================================================
   Barbarian / Dwarf — Unarmored Defense + racial HP
   ========================================================= */
{
  const c = build({
    classId: 'barbarian',
    speciesId: 'dwarf',
    abilityMethod: 'manual',
    baseAbilities: { str: 15, dex: 14, con: 15, int: 8, wis: 10, cha: 12 },
    backgroundId: 'soldier',
    bgAbility: { mode: '2-1', plus2: 'str', plus1: 'con' },
    classSkills: ['athletics', 'perception'],
    classChoices: { weaponMastery: ['Greataxe', 'Handaxe'], bgTool: 'Dice Set' },
    equipmentChoice: { class: 'A', background: 'a' }
  });
  const d = derive(c);
  check('Barbarian: STR 17', d.abilities.str, 17);
  check('Barbarian: CON 16', d.abilities.con, 16);
  // d12 + CON 3 + Dwarven Toughness 1
  check('Barbarian: HP = 12 + 3 + 1 (Dwarven Toughness)', d.hp, 16);
  // Unarmored Defense 10 + DEX 2 + CON 3, no shield in package A
  check('Barbarian: AC = 10 + 2 DEX + 3 CON', d.ac, 15);
  ok('Barbarian: AC explanation mentions Unarmored Defense', /Unarmored Defense/.test(d.acHow), d.acHow);
  check('Barbarian: darkvision 120 from Dwarf', d.darkvision, 120);
  check('Barbarian: poison resistance', d.resistances, ['Poison']);
  const ga = d.attacks.find(a => a.name === 'Greataxe');
  check('Barbarian: greataxe to-hit', ga.atk, 5);
  ok('Barbarian: greataxe mastery is Cleave', ga.mastery?.name === 'Cleave');
}

/* =========================================================
   Wizard / High Elf — spell DC, spellbook, bonus cantrip
   ========================================================= */
{
  const c = build({
    classId: 'wizard',
    speciesId: 'elf',
    speciesChoices: { lineage: 'high-elf', lineageAbility: 'int', keenSenses: 'perception' },
    abilityMethod: 'manual',
    baseAbilities: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 },
    backgroundId: 'sage',
    bgAbility: { mode: '2-1', plus2: 'int', plus1: 'con' },
    classSkills: ['arcana', 'investigation'],
    classChoices: {},
    featChoices: { 'magic-initiate-wizard': { cantrips: ['fire-bolt', 'light'], spell: 'shield', ability: 'int' } },
    equipmentChoice: { class: 'A', background: 'a' },
    spells: {
      cantrips: ['mage-hand', 'ray-of-frost', 'prestidigitation'],
      spellbook: ['detect-magic', 'feather-fall', 'mage-armor', 'magic-missile', 'sleep', 'thunderwave'],
      prepared: ['mage-armor', 'magic-missile', 'sleep', 'thunderwave']
    }
  });
  const d = derive(c);
  check('Wizard: INT 17', d.abilities.int, 17);
  check('Wizard: INT mod +3', d.mods.int, 3);
  check('Wizard: HP = 6 + 2', d.hp, 8);
  check('Wizard: spell save DC = 8 + 2 + 3', d.spellcasting.saveDC, 13);
  check('Wizard: spell attack = 2 + 3', d.spellcasting.attackBonus, 5);
  check('Wizard: 3 cantrips known', d.spellcasting.cantripsKnown, 3);
  check('Wizard: 6 spellbook spells', d.spellcasting.spellbookSpells, 6);
  check('Wizard: 4 prepared', d.spellcasting.preparedSpells, 4);
  check('Wizard: 2 first level slots', d.spellcasting.slots['1'], 2);
  // AC: no armor, no unarmored defense feature -> 10 + DEX
  check('Wizard: AC = 10 + 2 DEX', d.ac, 12);

  const bonusNames = d.bonusSpells.map(b => b.spell.name).sort();
  ok('Wizard: High Elf grants Prestidigitation', bonusNames.includes('Prestidigitation'), JSON.stringify(bonusNames));
  ok('Wizard: Magic Initiate grants Fire Bolt', bonusNames.includes('Fire Bolt'), JSON.stringify(bonusNames));
  ok('Wizard: Magic Initiate grants Shield', bonusNames.includes('Shield'), JSON.stringify(bonusNames));
  ok('Wizard: every step complete', STEPS_ALL_CLEAR(c), JSON.stringify(ALL_ISSUES(c)));
}

/* =========================================================
   Cleric — Divine Order Thaumaturge adds a cantrip
   ========================================================= */
{
  const c = build({
    classId: 'cleric',
    speciesId: 'human',
    speciesChoices: { size: 'Medium', skillful: 'perception', versatile: 'alert' },
    abilityMethod: 'manual',
    baseAbilities: { str: 12, dex: 10, con: 14, int: 10, wis: 15, cha: 13 },
    backgroundId: 'acolyte',
    bgAbility: { mode: '2-1', plus2: 'wis', plus1: 'con' },
    classSkills: ['insight', 'religion'],
    classChoices: { divineOrder: 'thaumaturge' },
    featChoices: { 'magic-initiate-cleric': { cantrips: ['guidance', 'light'], spell: 'bless', ability: 'wis' } },
    equipmentChoice: { class: 'A', background: 'a' },
    spells: { cantrips: ['sacred-flame', 'thaumaturgy', 'spare-the-dying', 'mending'], prepared: ['bless', 'cure-wounds', 'guiding-bolt', 'shield-of-faith'], spellbook: [] }
  });
  const d = derive(c);
  check('Cleric: WIS 17', d.abilities.wis, 17);
  check('Cleric: spell save DC = 8 + 2 + 3', d.spellcasting.saveDC, 13);
  check('Cleric: Thaumaturge gives a 4th cantrip', d.spellcasting.cantripsKnown, 4);
  // Chain Shirt 13 + min(DEX 0, 2) = 13, +2 Shield
  check('Cleric: AC = Chain Shirt 13 + Shield 2', d.ac, 15);
  check('Cleric: initiative includes Alert PB', d.initiative, 2);
  check('Cleric: HP = 8 + 2', d.hp, 10);
}

/* =========================================================
   Rogue — Expertise doubles proficiency
   ========================================================= */
{
  const c = build({
    classId: 'rogue',
    speciesId: 'halfling',
    abilityMethod: 'manual',
    baseAbilities: { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 },
    backgroundId: 'criminal',
    bgAbility: { mode: '2-1', plus2: 'dex', plus1: 'con' },
    classSkills: ['acrobatics', 'investigation', 'perception', 'deception'],
    classChoices: { expertise: ['stealth', 'sleightofhand'], weaponMastery: ['Dagger', 'Shortbow'], language: 'Elvish' },
    equipmentChoice: { class: 'A', background: 'a' },
    featChoices: {}
  });
  const d = derive(c);
  check('Rogue: DEX 17', d.abilities.dex, 17);
  const stealth = d.skills.find(s => s.id === 'stealth');
  check('Rogue: Stealth with Expertise = DEX 3 + 2*PB', stealth.mod, 7);
  ok('Rogue: Stealth flagged as expertise', stealth.expertise);
  ok('Rogue: Stealth came from the Criminal background', stealth.sources.includes('Criminal'), JSON.stringify(stealth.sources));
  const acro = d.skills.find(s => s.id === 'acrobatics');
  check('Rogue: Acrobatics without expertise = 3 + 2', acro.mod, 5);
  // Leather 11 + DEX 3
  check('Rogue: AC = Leather 11 + 3 DEX', d.ac, 14);
  // Criminal background grants the Alert feat, which adds the proficiency bonus to initiative.
  check('Rogue: initiative = DEX 3 + PB 2 from Alert', d.initiative, 5);
}

/* =========================================================
   Warlock — Pact Magic slot count and Armor of Shadows
   ========================================================= */
{
  const c = build({
    classId: 'warlock',
    speciesId: 'tiefling',
    speciesChoices: { size: 'Medium', legacy: 'infernal', legacyAbility: 'cha' },
    abilityMethod: 'manual',
    baseAbilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 15 },
    backgroundId: 'criminal',
    bgAbility: { mode: '2-1', plus2: 'cha', plus1: 'dex' },
    classSkills: ['arcana', 'deception'],
    classChoices: { invocation: 'armor-of-shadows' },
    equipmentChoice: { class: 'B', background: 'b' },   // gold only, so no armor
    spells: { cantrips: ['eldritch-blast', 'prestidigitation'], prepared: ['charm-person', 'hex'], spellbook: [] },
    featChoices: {}
  });
  const d = derive(c);
  check('Warlock: CHA 17', d.abilities.cha, 17);
  check('Warlock: 1 pact slot', d.spellcasting.slots['1'], 1);
  check('Warlock: slots recharge on a short rest', d.spellcasting.slotRecharge, 'Short or Long Rest');
  check('Warlock: spell save DC 13', d.spellcasting.saveDC, 13);
  // No armor purchased, Armor of Shadows -> Mage Armor 13 + DEX 3
  // DEX is 14 base +1 from the background, so the modifier is +2.
  check('Warlock: AC = Mage Armor 13 + 2 DEX', d.ac, 15);
  ok('Warlock: AC explanation names Armor of Shadows', /Armor of Shadows/.test(d.acHow), d.acHow);
  check('Warlock: fire resistance from Infernal legacy', d.resistances, ['Fire']);
  const names = d.bonusSpells.map(b => b.spell.name).sort();
  check('Warlock: Tiefling grants Fire Bolt and Thaumaturgy', names, ['Fire Bolt', 'Thaumaturgy']);
}

/* =========================================================
   Ranger — Hunter's Mark is always prepared and free
   ========================================================= */
{
  const c = build({
    classId: 'ranger',
    speciesId: 'wood-elf-stand-in' // intentionally invalid, replaced below
  });
  c.speciesId = 'elf';
  c.speciesChoices = { lineage: 'wood-elf', lineageAbility: 'wis', keenSenses: 'perception' };
  c.abilityMethod = 'manual';
  c.baseAbilities = { str: 10, dex: 15, con: 14, int: 8, wis: 14, cha: 12 };
  c.backgroundId = 'soldier';
  c.bgAbility = { mode: '2-1', plus2: 'dex', plus1: 'wis' };
  c.classSkills = ['stealth', 'survival', 'nature'];
  c.classChoices = { weaponMastery: ['Longbow', 'Shortsword'], bgTool: 'Dice Set' };
  c.equipmentChoice = { class: 'A', background: 'a' };
  c.spells = { cantrips: [], prepared: ['cure-wounds', 'ensnaring-strike'], spellbook: [] };
  const d = derive(c);
  check('Ranger: Wood Elf speed 35', d.speed, 35);
  check('Ranger: 0 cantrips', d.spellcasting.cantripsKnown, 0);
  check('Ranger: 2 prepared', d.spellcasting.preparedSpells, 2);
  const names = d.bonusSpells.map(b => b.spell.name);
  ok("Ranger: Hunter's Mark always prepared", names.includes("Hunter's Mark"), JSON.stringify(names));
  ok('Ranger: Wood Elf grants Druidcraft', names.includes('Druidcraft'), JSON.stringify(names));
  // Studded Leather 12 + DEX 3
  check('Ranger: AC = Studded Leather 12 + 3 DEX', d.ac, 15);
  const bow = d.attacks.find(a => a.name === 'Longbow');
  check('Ranger: longbow uses DEX', bow.ability, 'DEX');
  check('Ranger: longbow to-hit = DEX 3 + PB 2', bow.atk, 5);
}

/* =========================================================
   Monk — Unarmored Defense uses WIS, shield switches it off
   ========================================================= */
{
  const c = build({
    classId: 'monk',
    speciesId: 'human',
    speciesChoices: { size: 'Medium', skillful: 'stealth', versatile: 'alert' },
    abilityMethod: 'manual',
    baseAbilities: { str: 10, dex: 15, con: 13, int: 8, wis: 14, cha: 12 },
    backgroundId: 'criminal',
    bgAbility: { mode: '2-1', plus2: 'dex', plus1: 'wis' },
    classSkills: ['acrobatics', 'insight'],
    classChoices: { tools: ["Smith's Tools"] },
    equipmentChoice: { class: 'A', background: 'a' },
    featChoices: {}
  });
  const d = derive(c);
  check('Monk: DEX 17, WIS 15', [d.abilities.dex, d.abilities.wis], [17, 15]);
  check('Monk: AC = 10 + 3 DEX + 2 WIS', d.ac, 15);
  check('Monk: HP = 8 + 1', d.hp, 9);
}

/* =========================================================
   Background ability modes
   ========================================================= */
{
  const base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  const c = build({ classId: 'fighter', backgroundId: 'soldier', baseAbilities: { ...base } });
  c.bgAbility = { mode: '1-1-1', plus2: null, plus1: null };
  const f = finalAbilities(c);
  check('Background 1/1/1 adds +1 to STR, DEX, CON', [f.str, f.dex, f.con, f.int], [16, 15, 14, 12]);

  const c2 = build({ classId: 'fighter', backgroundId: 'soldier', baseAbilities: { ...base } });
  c2.bgAbility = { mode: '2-1', plus2: 'str', plus1: 'dex' };
  const f2 = finalAbilities(c2);
  check('Background 2/1 adds +2 STR and +1 DEX', [f2.str, f2.dex, f2.con], [17, 15, 13]);

  // Cap at 20
  const c3 = build({ classId: 'fighter', backgroundId: 'soldier', baseAbilities: { ...base, str: 19 } });
  c3.bgAbility = { mode: '2-1', plus2: 'str', plus1: 'dex' };
  check('Ability scores cap at 20', finalAbilities(c3).str, 20);
}

/* =========================================================
   Step validation catches incomplete characters
   ========================================================= */
{
  const empty = newCharacter();
  ok('Empty character: class step blocked', stepIssues(empty, 'class').length > 0);

  const c = build({ classId: 'fighter' });
  ok('Fighter with no skills chosen is blocked on proficiencies',
    stepIssues(c, 'proficiencies').some(i => /class skill/i.test(i)),
    JSON.stringify(stepIssues(c, 'proficiencies')));

  const overBudget = build({ abilityMethod: 'pointbuy', baseAbilities: { str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 } });
  ok('Point buy over budget is caught',
    stepIssues(overBudget, 'abilities').some(i => /over budget/.test(i)),
    JSON.stringify(stepIssues(overBudget, 'abilities')));

  const dupeBoost = build({ classId: 'fighter', backgroundId: 'soldier', baseAbilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } });
  dupeBoost.bgAbility = { mode: '2-1', plus2: 'str', plus1: 'str' };
  ok('Same ability for +2 and +1 is rejected',
    stepIssues(dupeBoost, 'background').some(i => /different abilities/.test(i)),
    JSON.stringify(stepIssues(dupeBoost, 'background')));
}

/* =========================================================
   Data integrity
   ========================================================= */
{
  check('12 classes', DATA.classes.classes.length, 12);
  check('9 species', DATA.species.species.length, 9);
  check('339 spells', DATA.spells.spells.length, 339);

  // Every recommended spell id in classes.json must resolve to a real spell.
  const missing = [];
  for (const c of DATA.classes.classes) {
    const rec = c.spellcasting?.recommended;
    if (!rec) continue;
    for (const key of ['cantrips', 'spells', 'spellbook']) {
      for (const id of rec[key] || []) if (!DATA.byId.spell[id]) missing.push(`${c.name}.${key}: ${id}`);
    }
    for (const id of c.spellcasting.alwaysPrepared || []) if (!DATA.byId.spell[id]) missing.push(`${c.name}.alwaysPrepared: ${id}`);
  }
  ok('All recommended class spells resolve', missing.length === 0, missing.join(', '));

  // Every species-granted cantrip must resolve.
  const missingSp = [];
  for (const s of DATA.species.species) {
    for (const id of s.effects?.cantrips || []) if (!DATA.byId.spell[id]) missingSp.push(`${s.name}: ${id}`);
    for (const ch of s.choices || []) {
      for (const o of ch.options || []) {
        for (const id of o.effects?.cantrips || []) if (!DATA.byId.spell[id]) missingSp.push(`${s.name}/${o.name}: ${id}`);
        for (const id of o.effects?.freeSpells || []) if (!DATA.byId.spell[id]) missingSp.push(`${s.name}/${o.name}: ${id}`);
      }
    }
  }
  ok('All species-granted spells resolve', missingSp.length === 0, missingSp.join(', '));

  // Background feats must exist.
  const missingFeat = DATA.backgrounds.backgrounds.filter(b => !DATA.byId.feat[b.feat]).map(b => b.name);
  ok('All background feats resolve', missingFeat.length === 0, missingFeat.join(', '));

  // Recommended weapon-mastery weapons must exist.
  const badW = [];
  for (const c of DATA.classes.classes) {
    for (const f of [...(c.features || []), ...(c.extraFeatures || [])]) {
      for (const w of [].concat(f.choice?.recommended || [])) {
        if (typeof w === 'string' && DATA.equipment.weapons.some(x => x.name === w) === false && !DATA.byId.skill[w] && !DATA.byId.feat[w]) {
          badW.push(`${c.name}: ${w}`);
        }
      }
    }
  }
  ok('All recommended weapons/skills/feats resolve', badW.length === 0, badW.join(', '));

  // Starting equipment armor names must match the armor table.
  const badArmor = [];
  for (const c of DATA.classes.classes) {
    for (const opt of c.startingEquipment || []) {
      for (const item of opt.items) {
        if (/armor|mail|plate|shirt|leather/i.test(item) && !/^shield$/i.test(item)) {
          if (!DATA.byId.armor[item]) badArmor.push(`${c.name}/${opt.id}: ${item}`);
        }
      }
    }
  }
  ok('All starting armor matches the armor table', badArmor.length === 0, badArmor.join(', '));
}

/* ---------- helpers used above ---------- */
function ALL_ISSUES(c) {
  const ids = ['class', 'species', 'abilities', 'background', 'proficiencies', 'spells'];
  const out = {};
  for (const id of ids) { const i = stepIssues(c, id); if (i.length) out[id] = i; }
  return out;
}
function STEPS_ALL_CLEAR(c) { return Object.keys(ALL_ISSUES(c)).length === 0; }

/* ---------- report ---------- */
for (const [status, name] of results) {
  if (status === 'FAIL') console.log(`  FAIL  ${name}`);
}
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail ? 1 : 0);
