/* The seven wizard steps. Each render fn paints into `root` and calls
   ctx.update() whenever the character changes. */

import { DATA, spellsFor } from './data.js';
import { el, pill, notice, counter, choiceCard, checkRow, difficultyDots, expandable } from './ui.js';
import { glossify } from './glossary.js';
import { ABILS, mod, fmt, derive, finalAbilities, backgroundBonuses, pointBuyCost, pointBuySpent, collectFeats, startingItems, speciesEffects } from './rules.js';

export const STEPS = [
  { id: 'class',         num: 1, label: 'Class' },
  { id: 'species',       num: 2, label: 'Species' },
  { id: 'abilities',     num: 3, label: 'Ability Scores' },
  { id: 'background',    num: 4, label: 'Background' },
  { id: 'proficiencies', num: 5, label: 'Proficiencies & Gear' },
  { id: 'spells',        num: 6, label: 'Spells' },
  { id: 'sheet',         num: 7, label: 'Character Sheet' }
];

const asArray = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** Rules text with the plain-language version beneath it. Glossary terms in
 *  the rules text define themselves on hover or tap. */
function ruleAndPlain(ruleText, plainText) {
  const wrap = el('div');
  if (ruleText) {
    const p = el('p', { class: 'ruletext' });
    p.appendChild(glossify(ruleText));
    wrap.appendChild(p);
  }
  if (plainText) wrap.appendChild(el('p', { class: 'plaintext', text: plainText }));
  return wrap;
}

function head(title, lede) {
  return el('div', { class: 'step-head' }, el('h2', { text: title }), el('p', { class: 'lede', text: lede }));
}

/* Toggle a value inside an array field, capped at `max`. */
function toggleCapped(arr, value, max) {
  const i = arr.indexOf(value);
  if (i >= 0) { arr.splice(i, 1); return true; }
  if (arr.length >= max) return false;
  arr.push(value);
  return true;
}

/* ============================ 1. CLASS ============================ */

export function renderClass(root, char, ctx) {
  root.appendChild(head('Step 1: Choose your class',
    'Your class decides how you fight, what you are good at, and whether you cast spells. It is the biggest decision here, which is why it comes first.'));

  root.appendChild(notice('tip', 'New to tabletop roleplaying?',
    'The three easiest classes are Fighter, Barbarian and Rogue. None of them cast spells at level 1, so there is much less to keep track of while you learn.'));

  root.appendChild(notice('', 'About subclasses',
    DATA.classes.rules.subclassNote));

  const grid = el('div', { class: 'cards' });
  for (const c of DATA.classes.classes) {
    const meta = [
      pill(`d${c.hitDie} hit die`),
      pill(c.role, 'info'),
      c.spellcasting ? pill('Spellcaster', 'accent') : pill('No spells', 'good'),
      difficultyDots(c.difficulty)
    ];
    if (c.beginnerPick) meta.unshift(pill('Good first pick', 'good'));

    grid.appendChild(choiceCard({
      id: c.id,
      title: c.name,
      tagline: c.tagline,
      plain: c.plain,
      meta,
      selected: char.classId === c.id,
      onPick: id => {
        if (char.classId !== id) {
          // Switching class invalidates every class-derived pick.
          char.classId = id;
          char.classSkills = [];
          char.classChoices = {};
          char.spells = { cantrips: [], prepared: [], spellbook: [] };
          char.equipmentChoice = { ...char.equipmentChoice, class: null };
        }
        ctx.update();
      }
    }));
  }
  root.appendChild(grid);

  if (char.classId) root.appendChild(classDetail(DATA.byId.class[char.classId]));
}

function classDetail(c) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: `${c.name}: what you get at level 1` }));
  p.appendChild(el('p', { class: 'panel-note', text: c.primaryAbilityNote }));

  const facts = el('div', { class: 'sumgrid' });
  const f = (k, v) => facts.appendChild(el('div', { class: 'sumitem' },
    el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })));
  f('Hit die', `d${c.hitDie}`);
  f('Hit points at level 1', `${c.hitDie} + your CON modifier`);
  f('Saving throws', c.savingThrows.map(a => DATA.byId.ability[a].name).join(' and '));
  f('Armor', c.armorTraining);
  f('Weapons', c.weaponProficiencies);
  f('Skills', `Choose ${c.skills.count}`);
  if (c.spellcasting) f('Spellcasting', `${DATA.byId.ability[c.spellcasting.ability].name}-based`);
  p.appendChild(facts);

  p.appendChild(el('h3', { text: 'Features', style: 'margin-top:16px' }));
  for (const feat of [...(c.features || []), ...(c.extraFeatures || [])]) {
    p.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: feat.name }),
      ruleAndPlain(feat.text, feat.plain)));
  }
  return p;
}

/* ============================ 2. SPECIES ============================ */

export function renderSpecies(root, char, ctx) {
  root.appendChild(head('Step 2: Choose your species',
    'Your species is what kind of person your character is. It gives you traits like darkvision, damage resistances, or a little free magic.'));

  root.appendChild(notice('warn', 'Important change in the 2024 rules', DATA.species.rules.noAsiNote));

  const grid = el('div', { class: 'cards' });
  for (const s of DATA.species.species) {
    const meta = [pill(`Speed ${s.speed} ft`), difficultyDots(s.complexity === 'simple' ? 1 : 2, 2)];
    if (s.effects?.darkvision) meta.push(pill(`Darkvision ${s.effects.darkvision} ft`, 'info'));
    if (s.choices?.length) meta.push(pill(`${s.choices.length} choice${s.choices.length > 1 ? 's' : ''} to make`));

    grid.appendChild(choiceCard({
      id: s.id, title: s.name, tagline: s.tagline, plain: s.plain, meta,
      selected: char.speciesId === s.id,
      onPick: id => {
        if (char.speciesId !== id) { char.speciesId = id; char.speciesChoices = {}; }
        ctx.update();
      }
    }));
  }
  root.appendChild(grid);

  if (!char.speciesId) return;
  const sp = DATA.byId.species[char.speciesId];

  // Traits: the real rules wording first, because that is what a player will
  // hear at a table, with the plain-language version underneath.
  const tp = el('div', { class: 'panel' });
  tp.appendChild(el('h3', { text: `${sp.name} traits` }));
  for (const t of sp.traits) {
    tp.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: t.name }),
      ruleAndPlain(t.text, t.plain)));
  }
  root.appendChild(tp);

  // Size choice
  if (sp.size.choice) {
    const p = el('div', { class: 'panel' });
    p.appendChild(el('h3', { text: 'Choose your size' }));
    p.appendChild(el('p', { class: 'panel-note', text: sp.size.note }));
    const g = el('div', { class: 'cards' });
    for (const sz of sp.size.choice) {
      g.appendChild(choiceCard({
        id: sz, title: sz, compact: true,
        plain: sz === 'Small' ? 'Small characters cannot use Heavy weapons well, but can slip through tight spaces.' : 'The standard size. No restrictions.',
        selected: char.speciesChoices.size === sz,
        onPick: v => { char.speciesChoices.size = v; ctx.update(); }
      }));
    }
    p.appendChild(g);
    root.appendChild(p);
  }

  // Species choices
  for (const ch of sp.choices || []) {
    root.appendChild(renderGrantChoice(ch, char, ctx, char.speciesChoices, sp.name));
  }
}

/* Renders one "choice" object (option list, skill pick, ability pick, feat pick). */
function renderGrantChoice(ch, char, ctx, store, ownerName) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: ch.label }));
  if (ch.help) p.appendChild(el('p', { class: 'panel-note', text: ch.help }));

  const g = ch.grant || {};
  const need = g.count || 1;

  if (ch.options) {
    const grid = el('div', { class: 'cards' });
    for (const o of ch.options) {
      const meta = [];
      if (o.later) meta.push(pill(`Level 3: ${o.later['3']}`, 'info'), pill(`Level 5: ${o.later['5']}`, 'info'));
      grid.appendChild(choiceCard({
        id: o.id, title: o.name, plain: o.plain || o.text, meta,
        selected: store[ch.id] === o.id,
        onPick: v => { store[ch.id] = v; ctx.update(); }
      }));
    }
    p.appendChild(grid);
    return p;
  }

  if (g.type === 'skill') {
    const pool = g.from === 'any' ? DATA.rules.skills.map(s => s.id) : g.from;
    const chosen = asArray(store[ch.id]).filter(Boolean);
    p.appendChild(counter(chosen.length, need, 'chosen'));
    const list = el('div', { class: 'checklist' });
    for (const id of pool) {
      const sk = DATA.byId.skill[id];
      const on = chosen.includes(id);
      list.appendChild(checkRow({
        label: sk.name, sub: sk.blurb,
        src: `${DATA.byId.ability[sk.ability].short} skill`,
        checked: on,
        disabled: !on && chosen.length >= need,
        onToggle: () => {
          const arr = asArray(store[ch.id]).filter(Boolean);
          toggleCapped(arr, id, need);
          store[ch.id] = need === 1 ? (arr[0] ?? null) : arr;
          ctx.update();
        }
      }));
    }
    p.appendChild(list);
    return p;
  }

  if (g.type === 'ability') {
    const pool = g.from === 'any' ? ABILS : g.from;
    const grid = el('div', { class: 'cards' });
    for (const a of pool) {
      const ab = DATA.byId.ability[a];
      grid.appendChild(choiceCard({
        id: a, title: ab.name, compact: true, plain: ab.blurb,
        selected: store[ch.id] === a,
        onPick: v => { store[ch.id] = v; ctx.update(); }
      }));
    }
    p.appendChild(grid);
    return p;
  }

  if (g.type === 'originFeat') {
    const grid = el('div', { class: 'cards' });
    for (const f of DATA.originFeats) {
      grid.appendChild(choiceCard({
        id: f.id, title: f.name, plain: f.plain,
        meta: f.id === 'skilled' ? [pill('Recommended', 'good')] : [],
        selected: store[ch.id] === f.id,
        onPick: v => { store[ch.id] = v; ctx.update(); }
      }));
    }
    p.appendChild(grid);
    return p;
  }

  p.appendChild(el('p', { class: 'muted', text: 'This choice is handled on the Proficiencies step.' }));
  return p;
}

/* ============================ 3. ABILITY SCORES ============================ */

const METHODS = [
  { id: 'standard', name: 'Standard Array', plain: 'Everyone uses the same six numbers: 15, 14, 13, 12, 10, 8. Fast, fair, and balanced. Best for a first character.', rec: true },
  { id: 'pointbuy', name: 'Point Buy', plain: 'Spend 27 points to build your own scores from 8 to 15. More control, no luck involved.' },
  { id: 'roll',     name: 'Roll for it', plain: 'Roll 4d6 and drop the lowest, six times. Exciting, but you might roll badly.' },
  { id: 'manual',   name: 'Enter manually', plain: 'Type in scores your DM gave you, or copy a character you already made.' }
];

export function renderAbilities(root, char, ctx) {
  root.appendChild(head('Step 3: Ability scores',
    'Six numbers that describe what your character is naturally good at. Everything you roll in the game uses one of them.'));

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (cls) {
    const order = cls.abilityPriority?.default || cls.abilityPriority?.[cls.primaryAbility[0]] || [];
    // Each ability row is labelled with its priority, so this only needs to
    // name the top three in full and explain why.
    root.appendChild(notice('tip', `Where to put your best scores as a ${cls.name}`,
      order.length
        ? `Highest score in ${DATA.byId.ability[order[0]].name}, next in ${DATA.byId.ability[order[1]].name}, then ${DATA.byId.ability[order[2]].name}. ${cls.primaryAbilityNote}`
        : cls.primaryAbilityNote));
  }

  // Method picker
  const mp = el('div', { class: 'panel' });
  mp.appendChild(el('h3', { text: 'How do you want to generate scores?' }));
  const mg = el('div', { class: 'methods' });
  for (const m of METHODS) {
    mg.appendChild(choiceCard({
      id: m.id, title: m.name, plain: m.plain,
      meta: m.rec ? [pill('Recommended', 'good')] : [],
      selected: char.abilityMethod === m.id,
      onPick: id => {
        char.abilityMethod = id;
        char.standardAssign = {}; char.rollAssign = {};
        if (id !== 'roll') char.rolledSet = null;
        if (id === 'pointbuy') for (const a of ABILS) char.baseAbilities[a] = 8;
        if (id === 'standard' || id === 'roll') for (const a of ABILS) char.baseAbilities[a] = 0;
        if (id === 'manual') for (const a of ABILS) char.baseAbilities[a] = char.baseAbilities[a] || 10;
        ctx.update();
      }
    }));
  }
  mp.appendChild(mg);
  root.appendChild(mp);

  const panel = el('div', { class: 'panel' });
  if (char.abilityMethod === 'standard') renderAssign(panel, char, ctx, DATA.rules.standardArray, 'standardAssign', 'Standard Array');
  else if (char.abilityMethod === 'pointbuy') renderPointBuy(panel, char, ctx);
  else if (char.abilityMethod === 'roll') renderRoll(panel, char, ctx);
  else renderManual(panel, char, ctx);
  root.appendChild(panel);

  root.appendChild(notice('', 'Your background adds more',
    'You are not finished yet. In the next step your background adds +3 more points spread across three abilities, so a 15 here can become a 17.'));
}

/** Priority order for the chosen class, best ability first. */
function abilityOrder(char) {
  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (!cls) return [];
  const ap = cls.abilityPriority || {};
  return ap.default || ap[cls.primaryAbility[0]] || [];
}

/** How much this class cares about an ability, so the step can say so on the
 *  row itself rather than only in a paragraph above. */
function abilityAdvice(char, a) {
  const order = abilityOrder(char);
  const i = order.indexOf(a);
  if (i < 0) return null;
  if (i === 0) return { label: 'Most important', kind: 'good', rank: 1 };
  if (i === 1) return { label: 'Second most important', kind: 'accent', rank: 2 };
  if (i === 2) return { label: 'Third', kind: 'info', rank: 3 };
  if (i >= order.length - 1) return { label: 'Safe to dump', kind: '', rank: i + 1 };
  return null;
}

function abilityRow(char, a, opts) {
  const ab = DATA.byId.ability[a];
  const score = char.baseAbilities[a] || 0;
  const advice = abilityAdvice(char, a);
  const name = el('div', { class: 'aname' },
    ab.name,
    advice ? pill(advice.label, advice.kind) : null,
    el('small', { text: ab.blurb }));
  return el('div', { class: `abilrow${advice && advice.rank === 1 ? ' key' : ''}` },
    name,
    opts.control,
    el('div', { class: 'score', text: score || '—' }),
    el('div', { class: 'modbox', text: score ? fmt(mod(score)) : '—' })
  );
}

function renderAssign(panel, char, ctx, values, assignKey, label) {
  panel.appendChild(el('h3', { text: `Assign the ${label}` }));
  panel.appendChild(el('p', { class: 'panel-note', text: 'Each number can be used once. Put your highest number in the ability your class cares about most.' }));

  // One click does what the advice on each row describes: highest number into
  // the ability the class needs most, and down from there.
  const order = abilityOrder(char);
  if (order.length === 6) {
    const cls = DATA.byId.class[char.classId];
    panel.appendChild(el('div', { class: 'row', style: 'margin-bottom:12px' },
      el('button', {
        type: 'button', class: 'btn primary', text: `Fill in the recommended ${cls.name} spread`,
        onClick: () => {
          const ranked = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
          char[assignKey] = {};
          order.forEach((abil, n) => { char[assignKey][abil] = ranked[n].i; });
          for (const x of ABILS) char.baseAbilities[x] = values[char[assignKey][x]];
          ctx.update();
        }
      }),
      el('span', { class: 'muted', style: 'font-size:.82rem',
        text: 'You can change any of it afterwards.' })));
  }

  const chips = el('div', { class: 'rollgrid' });
  values.forEach((v, i) => {
    const takenBy = Object.entries(char[assignKey]).find(([, idx]) => idx === i);
    chips.appendChild(el('div', { class: 'rollchip', style: takenBy ? 'opacity:.4' : '' },
      String(v),
      el('small', { text: takenBy ? DATA.byId.ability[takenBy[0]].short : 'free' })));
  });
  panel.appendChild(chips);

  for (const a of ABILS) {
    const sel = el('select', {
      onChange: e => {
        const v = e.target.value;
        const idx = v === '' ? null : Number(v);
        // Release this index from any other ability first.
        for (const k of Object.keys(char[assignKey])) {
          if (char[assignKey][k] === idx && k !== a) delete char[assignKey][k];
        }
        if (idx === null) delete char[assignKey][a]; else char[assignKey][a] = idx;
        for (const x of ABILS) {
          const i = char[assignKey][x];
          char.baseAbilities[x] = i == null ? 0 : values[i];
        }
        ctx.update();
      }
    });
    sel.appendChild(el('option', { value: '', text: '— pick —' }));
    values.forEach((v, i) => {
      const usedByOther = Object.entries(char[assignKey]).some(([k, idx]) => idx === i && k !== a);
      sel.appendChild(el('option', {
        value: String(i), text: String(v),
        selected: char[assignKey][a] === i, disabled: usedByOther
      }));
    });
    panel.appendChild(abilityRow(char, a, { control: sel }));
  }
}

function renderPointBuy(panel, char, ctx) {
  const budget = DATA.rules.pointBuy.budget;
  const spent = pointBuySpent(char.baseAbilities);
  const over = spent > budget;

  panel.appendChild(el('h3', { text: 'Point Buy' }));
  panel.appendChild(el('p', { class: 'panel-note', text: `Scores run from ${DATA.rules.pointBuy.min} to ${DATA.rules.pointBuy.max}. Going from 13 to 14 and 14 to 15 costs extra, so spreading points is often better than maxing one score.` }));
  panel.appendChild(el('div', { class: `pointbar${over ? ' over' : ''}` },
    el('span', {}, 'Points remaining'),
    el('b', { text: `${budget - spent}` }),
    el('span', { class: 'muted', text: `of ${budget}` })));

  for (const a of ABILS) {
    const score = char.baseAbilities[a];
    const nextCost = pointBuyCost(score + 1);
    const canUp = score < DATA.rules.pointBuy.max && nextCost != null && (spent - pointBuyCost(score) + nextCost) <= budget;
    const canDown = score > DATA.rules.pointBuy.min;
    const ctrl = el('div', { class: 'stepbtns' },
      el('button', { type: 'button', class: 'btn small', disabled: !canDown, 'aria-label': `Lower ${a}`, text: '−',
        onClick: () => { char.baseAbilities[a]--; ctx.update(); } }),
      el('button', { type: 'button', class: 'btn small', disabled: !canUp, 'aria-label': `Raise ${a}`, text: '+',
        onClick: () => { char.baseAbilities[a]++; ctx.update(); } })
    );
    panel.appendChild(abilityRow(char, a, { control: ctrl }));
  }
}

function roll4d6DropLowest() {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
  dice.sort((a, b) => a - b);
  return { total: dice[1] + dice[2] + dice[3], dice };
}

function renderRoll(panel, char, ctx) {
  panel.appendChild(el('h3', { text: 'Roll for scores' }));
  panel.appendChild(el('p', { class: 'panel-note', text: 'Rolls 4d6 six times and drops the lowest die each time. Ask your DM before rerolling a bad set.' }));

  panel.appendChild(el('div', { class: 'row' },
    el('button', {
      type: 'button', class: 'btn primary',
      text: char.rolledSet ? 'Roll again' : 'Roll 6 sets',
      onClick: () => {
        char.rolledSet = Array.from({ length: 6 }, () => roll4d6DropLowest().total).sort((a, b) => b - a);
        char.rollAssign = {};
        for (const a of ABILS) char.baseAbilities[a] = 0;
        ctx.update();
      }
    }),
    char.rolledSet ? el('span', { class: 'muted', text: `Total: ${char.rolledSet.reduce((a, b) => a + b, 0)}` }) : null
  ));

  if (!char.rolledSet) return;
  renderAssign(panel, char, ctx, char.rolledSet, 'rollAssign', 'rolled scores');
}

function renderManual(panel, char, ctx) {
  panel.appendChild(el('h3', { text: 'Enter scores manually' }));
  panel.appendChild(el('p', { class: 'panel-note', text: 'Anything from 1 to 20. This does not check any rules, so use it only if your DM told you to.' }));
  for (const a of ABILS) {
    const input = el('input', {
      type: 'number', min: '1', max: '20', value: String(char.baseAbilities[a] || 10),
      style: 'width:88px',
      onInput: e => {
        const v = Math.max(1, Math.min(20, Number(e.target.value) || 0));
        char.baseAbilities[a] = v; ctx.update({ keepFocus: e.target });
      }
    });
    panel.appendChild(abilityRow(char, a, { control: input }));
  }
}

/* ============================ 4. BACKGROUND ============================ */

export function renderBackground(root, char, ctx) {
  root.appendChild(head('Step 4: Choose your background',
    'What your character did before adventuring. This is where your ability score bonuses come from, plus an Origin feat, two skills, a tool and some gear.'));

  root.appendChild(notice('', 'How the ability bonuses work', DATA.backgrounds.rules.parts[0].plain));

  const grid = el('div', { class: 'cards' });
  for (const b of DATA.backgrounds.backgrounds) {
    const feat = DATA.byId.feat[b.feat];
    const meta = [
      pill(b.abilities.map(a => DATA.byId.ability[a].short).join(' / '), 'accent'),
      pill(feat ? feat.name : b.feat, 'info'),
      ...b.skills.map(s => pill(DATA.byId.skill[s].name))
    ];
    if (char.classId && b.goodFor?.includes(char.classId)) meta.unshift(pill(`Good for ${DATA.byId.class[char.classId].name}`, 'good'));

    grid.appendChild(choiceCard({
      id: b.id, title: b.name, tagline: b.tagline, plain: b.plain, meta,
      selected: char.backgroundId === b.id,
      onPick: id => {
        if (char.backgroundId !== id) {
          char.backgroundId = id;
          char.bgAbility = { mode: '2-1', plus2: null, plus1: null };
          char.featChoices = {};
        }
        ctx.update();
      }
    }));
  }

  const custom = DATA.backgrounds.custom;
  grid.appendChild(choiceCard({
    id: 'custom', title: custom.name, tagline: custom.tagline, plain: custom.plain,
    meta: [pill('You choose everything', 'warn'), pill('Ask your DM first', 'warn')],
    selected: char.backgroundId === 'custom',
    onPick: () => {
      if (char.backgroundId !== 'custom') {
        char.backgroundId = 'custom';
        char.bgAbility = { mode: '2-1', plus2: null, plus1: null };
        char.customBg = { abilities: [], feat: null, skills: [], tool: null };
        char.featChoices = {};
      }
      ctx.update();
    }
  }));
  root.appendChild(grid);

  if (!char.backgroundId) return;

  if (char.backgroundId === 'custom') renderCustomBackground(root, char, ctx);
  else {
    const b = DATA.byId.background[char.backgroundId];
    const p = el('div', { class: 'panel' });
    p.appendChild(el('h3', { text: `${b.name}: what you get` }));
    const feat = DATA.byId.feat[b.feat];
    p.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: `Origin feat: ${feat ? feat.name : b.feat}` }),
      ruleAndPlain((feat?.benefits || []).map(x => x.text).join(' '), feat ? feat.plain : '')));
    p.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: 'Skill proficiencies' }),
      el('p', { text: b.skills.map(s => DATA.byId.skill[s].name).join(' and ') })));
    p.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: 'Tool proficiency' }),
      el('p', { text: b.tools[0].fixed || b.tools[0].label })));
    root.appendChild(p);
  }

  renderAbilityBoost(root, char, ctx);
}

function renderCustomBackground(root, char, ctx) {
  const custom = DATA.backgrounds.custom;
  for (const step of custom.steps) {
    const p = el('div', { class: 'panel' });
    p.appendChild(el('h3', { text: `${step.n}. ${step.name}` }));
    p.appendChild(el('p', { class: 'panel-note', text: step.text }));

    if (step.n === 1) {
      if (step.guidance) {
        const ul = el('ul', { style: 'font-size:.86rem;color:var(--text-dim);margin:0 0 12px;padding-left:18px' });
        for (const g of step.guidance) ul.appendChild(el('li', {}, el('b', { text: g.ability + ': ' }), g.text));
        p.appendChild(ul);
      }
      p.appendChild(counter(char.customBg.abilities.filter(Boolean).length, 3, 'chosen'));
      const list = el('div', { class: 'checklist' });
      for (const a of ABILS) {
        const ab = DATA.byId.ability[a];
        const on = char.customBg.abilities.includes(a);
        list.appendChild(checkRow({
          label: ab.name, sub: ab.blurb, checked: on,
          disabled: !on && char.customBg.abilities.length >= 3,
          onToggle: () => {
            toggleCapped(char.customBg.abilities, a, 3);
            char.bgAbility = { mode: char.bgAbility.mode, plus2: null, plus1: null };
            ctx.update();
          }
        }));
      }
      p.appendChild(list);
    } else if (step.n === 2) {
      const grid = el('div', { class: 'cards' });
      for (const f of DATA.originFeats) {
        grid.appendChild(choiceCard({
          id: f.id, title: f.name, plain: f.plain,
          selected: char.customBg.feat === f.id,
          onPick: v => { char.customBg.feat = v; char.featChoices = {}; ctx.update(); }
        }));
      }
      p.appendChild(grid);
    } else if (step.n === 3) {
      p.appendChild(counter(char.customBg.skills.filter(Boolean).length, 2, 'chosen'));
      const list = el('div', { class: 'checklist' });
      for (const s of DATA.rules.skills) {
        const on = char.customBg.skills.includes(s.id);
        list.appendChild(checkRow({
          label: s.name, sub: s.blurb, src: DATA.byId.ability[s.ability].short,
          checked: on, disabled: !on && char.customBg.skills.length >= 2,
          onToggle: () => { toggleCapped(char.customBg.skills, s.id, 2); ctx.update(); }
        }));
      }
      p.appendChild(list);
    } else if (step.n === 4) {
      const sel = el('select', { onChange: e => { char.customBg.tool = e.target.value || null; ctx.update(); } });
      sel.appendChild(el('option', { value: '', text: '— pick a tool —' }));
      for (const [group, tools] of Object.entries(DATA.equipment.toolCategories)) {
        const og = el('optgroup', { label: group.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase()) });
        for (const t of tools) og.appendChild(el('option', { value: t, text: t, selected: char.customBg.tool === t }));
        sel.appendChild(og);
      }
      p.appendChild(sel);
    } else {
      p.appendChild(notice('tip', 'Equipment',
        'Work out a 50 GP kit with your DM, or just take the flat 50 GP and buy gear from the Equipment tables. Do not include martial weapons or armor, since your class already gives you those.'));
    }
    root.appendChild(p);
  }
}

function renderAbilityBoost(root, char, ctx) {
  const bg = DATA.byId.background[char.backgroundId];
  const abilities = char.backgroundId === 'custom' ? char.customBg.abilities.filter(Boolean) : bg.abilities;
  if (abilities.length < 3) return;

  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: 'Now spend your +3' }));
  p.appendChild(el('p', { class: 'panel-note', text: DATA.backgrounds.rules.asiNote }));

  const modes = el('div', { class: 'cards' });
  modes.appendChild(choiceCard({
    id: '2-1', title: '+2 and +1', compact: true,
    plain: 'Put +2 in one ability and +1 in another. Best when you want one score as high as possible.',
    meta: [pill('Most common', 'good')],
    selected: char.bgAbility.mode === '2-1',
    onPick: () => { char.bgAbility = { mode: '2-1', plus2: null, plus1: null }; ctx.update(); }
  }));
  modes.appendChild(choiceCard({
    id: '1-1-1', title: '+1 to all three', compact: true,
    plain: 'Spread it evenly. Good when you need several decent scores, like a Paladin or Monk.',
    selected: char.bgAbility.mode === '1-1-1',
    onPick: () => { char.bgAbility = { mode: '1-1-1', plus2: null, plus1: null }; ctx.update(); }
  }));
  p.appendChild(modes);

  // One row per eligible ability, each showing the score before and after and
  // carrying its own buttons. Previously this was two separate card grids
  // asking "which gets +2" then "which gets +1", which made it hard to see
  // what the three abilities actually ended up as.
  p.appendChild(el('h4', { text: `${bg.name} raises these three abilities`, style: 'margin-top:16px' }));

  const rows = el('div', { class: 'boostlist' });
  for (const a of abilities) {
    const ab = DATA.byId.ability[a];
    const base = char.baseAbilities[a] || 0;
    const gain = char.bgAbility.mode === '1-1-1'
      ? 1
      : char.bgAbility.plus2 === a ? 2 : char.bgAbility.plus1 === a ? 1 : 0;
    const after = Math.min(20, base + gain);

    const controls = el('div', { class: 'boostbtns' });
    if (char.bgAbility.mode === '2-1') {
      for (const amount of [2, 1]) {
        const key = amount === 2 ? 'plus2' : 'plus1';
        const other = amount === 2 ? 'plus1' : 'plus2';
        const on = char.bgAbility[key] === a;
        controls.appendChild(el('button', {
          type: 'button',
          class: `btn small${on ? ' primary' : ''}`,
          'aria-pressed': on ? 'true' : 'false',
          text: `+${amount}`,
          onClick: () => {
            if (on) { char.bgAbility[key] = null; }
            else {
              if (char.bgAbility[other] === a) char.bgAbility[other] = null;
              char.bgAbility[key] = a;
            }
            ctx.update();
          }
        }));
      }
    } else {
      controls.appendChild(pill('+1 automatically', 'good'));
    }

    rows.appendChild(el('div', { class: `boostrow${gain ? ' on' : ''}` },
      el('div', { class: 'bname' }, ab.name, el('small', { text: ab.blurb })),
      controls,
      el('div', { class: 'bmath' },
        el('span', { class: 'was', text: base || '—' }),
        el('span', { class: 'arrow', text: '→' }),
        el('span', { class: 'now', text: after || '—' }),
        el('small', { text: after ? `modifier ${fmt(mod(after))}` : '' }))
    ));
  }
  p.appendChild(rows);

  if (char.bgAbility.mode === '2-1') {
    const need = [];
    if (!char.bgAbility.plus2) need.push('+2');
    if (!char.bgAbility.plus1) need.push('+1');
    p.appendChild(need.length
      ? notice('warn', `Still to place: ${need.join(' and ')}`, 'Tap the buttons above to put each bonus on an ability.')
      : notice('tip', 'Both bonuses placed', 'Your final scores are below.'));
  }

  // Final scores across all six, so the effect on the whole character is visible.
  const finals = finalAbilities(char);
  const bonus = backgroundBonuses(char);
  const prev = el('div', { class: 'abilgrid', style: 'margin-top:8px' });
  for (const a of ABILS) {
    const ab = DATA.byId.ability[a];
    prev.appendChild(el('div', { class: 'abilbox', style: bonus[a] ? 'border-color:var(--good)' : '' },
      el('div', { class: 'k', text: ab.name }),
      el('div', { class: 'm', text: fmt(mod(finals[a])) }),
      el('div', { class: 's', text: bonus[a] ? `${finals[a]}  (+${bonus[a]})` : String(finals[a]) })));
  }
  p.appendChild(el('h4', { text: 'Your final ability scores', style: 'margin-top:16px' }));
  p.appendChild(prev);
  root.appendChild(p);
}

/* ============================ 5. PROFICIENCIES & GEAR ============================ */

export function renderProficiencies(root, char, ctx) {
  root.appendChild(head('Step 5: Proficiencies and gear',
    'Now pick the skills your class trains you in, any choices your class features ask for, and the equipment you start with.'));

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (!cls) { root.appendChild(notice('warn', 'Pick a class first', 'Go back to step 1.')); return; }

  root.appendChild(notice('', 'What proficiency means', DATA.rules.glossary.find(g => g.term === 'Proficiency Bonus').text));

  // --- class skills ---
  const sp = el('div', { class: 'panel' });
  sp.appendChild(el('h3', { text: `${cls.name} skills` }));
  sp.appendChild(el('p', { class: 'panel-note', text: `Choose ${cls.skills.count}. Skills already given by your background or species are marked and cannot be picked twice.` }));
  sp.appendChild(counter(char.classSkills.length, cls.skills.count, 'chosen'));

  const already = new Map();
  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (bg) {
    const bgs = char.backgroundId === 'custom' ? char.customBg.skills : bg.skills || [];
    for (const s of bgs) already.set(s, bg.name);
  }
  const spc = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  if (spc) for (const ch of spc.choices || []) {
    if (ch.grant?.type === 'skill') for (const v of asArray(char.speciesChoices[ch.id])) if (v) already.set(v, spc.name);
  }

  const pool = cls.skills.from === 'any' ? DATA.rules.skills.map(s => s.id) : cls.skills.from;
  const list = el('div', { class: 'checklist' });
  for (const id of pool) {
    const sk = DATA.byId.skill[id];
    const dupe = already.get(id);
    const on = char.classSkills.includes(id);
    list.appendChild(checkRow({
      label: sk.name, sub: sk.blurb,
      src: dupe ? `already from ${dupe}` : DATA.byId.ability[sk.ability].short,
      checked: on,
      disabled: !!dupe || (!on && char.classSkills.length >= cls.skills.count),
      onToggle: () => { toggleCapped(char.classSkills, id, cls.skills.count); ctx.update(); }
    }));
  }
  sp.appendChild(list);
  root.appendChild(sp);

  // --- class feature choices ---
  for (const f of [...(cls.features || []), ...(cls.extraFeatures || [])]) {
    if (!f.choice) continue;
    root.appendChild(renderClassChoice(f, char, ctx, cls));
  }

  // --- class tool choices ---
  if (cls.toolProficiencies && typeof cls.toolProficiencies === 'object') {
    root.appendChild(renderToolPicker(cls.toolProficiencies, char, ctx));
  }

  // --- background tool that needs a pick ---
  if (bg && char.backgroundId !== 'custom') {
    for (const t of bg.tools || []) {
      if (!t.chooseFrom) continue;
      const p = el('div', { class: 'panel' });
      p.appendChild(el('h3', { text: `${bg.name}: ${t.label}` }));
      const g = el('div', { class: 'cards' });
      for (const opt of DATA.equipment.toolCategories[t.chooseFrom] || []) {
        g.appendChild(choiceCard({
          id: opt, title: opt, compact: true,
          selected: char.classChoices.bgTool === opt,
          onPick: v => { char.classChoices.bgTool = v; ctx.update(); }
        }));
      }
      p.appendChild(g);
      root.appendChild(p);
    }
  }

  // --- feat choices ---
  for (const { feat, source } of collectFeats(char)) {
    if (!feat.choices?.length) continue;
    root.appendChild(renderFeatChoices(feat, source, char, ctx));
  }

  // --- equipment ---
  root.appendChild(renderEquipment(char, ctx, cls, bg));
}

function renderClassChoice(f, char, ctx, cls) {
  const ch = f.choice;
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: `${f.name}: ${ch.label}` }));
  p.appendChild(el('p', { class: 'panel-note', text: f.plain }));

  const g = ch.grant;
  const need = g.count || 1;
  const cur = asArray(char.classChoices[ch.id]).filter(Boolean);

  if (ch.options) {
    const grid = el('div', { class: 'cards' });
    for (const o of ch.options) {
      grid.appendChild(choiceCard({
        id: o.id, title: o.name, plain: o.plain || o.text,
        selected: char.classChoices[ch.id] === o.id,
        onPick: v => { char.classChoices[ch.id] = v; ctx.update(); }
      }));
    }
    p.appendChild(grid);
    return p;
  }

  if (g.type === 'feat') {
    const grid = el('div', { class: 'cards' });
    const pool = g.category === 'fightingStyle' ? DATA.fightingStyles : DATA.originFeats;
    for (const ft of pool) {
      grid.appendChild(choiceCard({
        id: ft.id, title: ft.name, plain: ft.plain,
        meta: ch.recommended === ft.id ? [pill('Recommended', 'good')] : [],
        selected: char.classChoices[ch.id] === ft.id,
        onPick: v => { char.classChoices[ch.id] = v; ctx.update(); }
      }));
    }
    p.appendChild(grid);
    return p;
  }

  if (g.type === 'weaponMastery') {
    const weapons = DATA.equipment.weapons.filter(w => {
      if (g.from === 'simple-or-martial-melee') return w.range === 'melee';
      if (g.from === 'proficientWeapons') {
        const prof = cls.weaponProficiencies.toLowerCase();
        if (prof.includes('simple and martial')) return true;
        if (prof.includes('finesse or light')) return w.category === 'simple' || w.properties.some(x => /Finesse|Light/i.test(x));
        if (prof.includes('light property')) return w.category === 'simple' || w.properties.some(x => /Light/i.test(x));
        return w.category === 'simple';
      }
      return true;
    });
    p.appendChild(counter(cur.length, need, 'chosen'));
    const l = el('div', { class: 'checklist' });
    for (const w of weapons) {
      const m = DATA.byId.mastery[w.mastery];
      const on = cur.includes(w.name);
      const rec = asArray(ch.recommended).includes(w.name);
      l.appendChild(checkRow({
        label: `${w.name} — ${m.name}`,
        sub: `${w.damage} ${w.damageType}. ${m.plain}`,
        src: rec ? 'recommended' : '',
        checked: on, disabled: !on && cur.length >= need,
        onToggle: () => {
          const arr = asArray(char.classChoices[ch.id]).filter(Boolean);
          toggleCapped(arr, w.name, need);
          char.classChoices[ch.id] = arr; ctx.update();
        }
      }));
    }
    p.appendChild(l);
    return p;
  }

  if (g.type === 'expertise') {
    if (!char.classSkills.length) {
      p.appendChild(notice('warn', 'Choose your class skills first', 'Expertise doubles your bonus in skills you are already proficient in.'));
      return p;
    }
    const opts = new Set(char.classSkills);
    const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
    if (bg) for (const s of (char.backgroundId === 'custom' ? char.customBg.skills : bg.skills || [])) opts.add(s);
    p.appendChild(counter(cur.length, need, 'chosen'));
    const l = el('div', { class: 'checklist' });
    for (const id of opts) {
      const sk = DATA.byId.skill[id];
      const on = cur.includes(id);
      const rec = asArray(ch.recommended).includes(id);
      l.appendChild(checkRow({
        label: sk.name, sub: `Your bonus becomes +4 instead of +2. ${sk.blurb}`,
        src: rec ? 'recommended' : '',
        checked: on, disabled: !on && cur.length >= need,
        onToggle: () => {
          const arr = asArray(char.classChoices[ch.id]).filter(Boolean);
          toggleCapped(arr, id, need);
          char.classChoices[ch.id] = arr; ctx.update();
        }
      }));
    }
    p.appendChild(l);
    return p;
  }

  if (g.type === 'language') {
    const sel = el('select', { onChange: e => { char.classChoices[ch.id] = e.target.value || null; ctx.update(); } });
    sel.appendChild(el('option', { value: '', text: '— pick a language —' }));
    for (const lang of DATA.equipment.languages.standard) {
      sel.appendChild(el('option', { value: lang, text: lang, selected: char.classChoices[ch.id] === lang }));
    }
    p.appendChild(sel);
    return p;
  }

  return p;
}

function renderToolPicker(spec, char, ctx) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: spec.label }));
  const cur = asArray(char.classChoices.tools).filter(Boolean);
  p.appendChild(counter(cur.length, spec.count, 'chosen'));

  const groups = spec.from === 'artisanOrInstrument'
    ? ['artisansTools', 'musicalInstrument']
    : [spec.from];

  const l = el('div', { class: 'checklist' });
  for (const gkey of groups) {
    for (const t of DATA.equipment.toolCategories[gkey] || []) {
      const on = cur.includes(t);
      l.appendChild(checkRow({
        label: t, checked: on, disabled: !on && cur.length >= spec.count,
        onToggle: () => {
          const arr = asArray(char.classChoices.tools).filter(Boolean);
          toggleCapped(arr, t, spec.count);
          char.classChoices.tools = arr; ctx.update();
        }
      }));
    }
  }
  p.appendChild(l);
  return p;
}

/** Every spell the character already knows, excluding one feat's own picks.
 *  Used to stop the same spell being taken twice from two different sources.
 *  Returns Map<spellId, sourceName>. */
function spellsKnownElsewhere(char, exceptFeatId) {
  const known = new Map();
  const add = (id, src) => { if (id && !known.has(id)) known.set(id, src); };

  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  if (sp) {
    const eff = speciesEffects(char);
    for (const id of eff.cantrips) add(id, sp.name);
    for (const id of eff.freeSpells) add(id, sp.name);
  }

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (cls) {
    for (const id of cls.spellcasting?.alwaysPrepared || []) add(id, cls.name);
    for (const id of char.spells.cantrips) add(id, `${cls.name} cantrips`);
    for (const id of char.spells.prepared) add(id, `${cls.name} spells`);
    for (const id of char.spells.spellbook) add(id, 'your spellbook');
  }

  for (const { feat } of collectFeats(char)) {
    if (feat.id === exceptFeatId) continue;
    const picks = char.featChoices[feat.id];
    if (!picks) continue;
    for (const id of picks.cantrips || []) add(id, feat.name);
    if (picks.spell) add(picks.spell, feat.name);
  }
  return known;
}

/** Skill and tool proficiencies the character already holds, ignoring one
 *  feat's own picks. Returns Map<skillId|toolName, sourceName>. */
function profsHeldElsewhere(char, exceptFeatId) {
  const held = new Map();
  const add = (id, src) => { if (id && !held.has(id)) held.set(id, src); };

  const cls = char.classId ? DATA.byId.class[char.classId] : null;
  if (cls) {
    for (const s of char.classSkills) add(s, cls.name);
    if (typeof cls.toolProficiencies === 'string') add(cls.toolProficiencies, cls.name);
    for (const t of asArray(char.classChoices.tools)) add(t, cls.name);
  }

  const bg = char.backgroundId ? DATA.byId.background[char.backgroundId] : null;
  if (bg) {
    const skills = char.backgroundId === 'custom' ? char.customBg.skills : bg.skills || [];
    for (const s of skills) add(s, bg.name);
    if (char.backgroundId === 'custom') add(char.customBg.tool, bg.name);
    else for (const t of bg.tools || []) add(t.fixed || char.classChoices.bgTool, bg.name);
  }

  const sp = char.speciesId ? DATA.byId.species[char.speciesId] : null;
  if (sp) {
    for (const ch of sp.choices || []) {
      if (ch.grant?.type !== 'skill') continue;
      for (const v of asArray(char.speciesChoices[ch.id])) add(v, sp.name);
    }
  }

  for (const { feat } of collectFeats(char)) {
    if (feat.id === exceptFeatId) continue;
    for (const v of asArray(char.featChoices[feat.id]?.profs)) add(v, feat.name);
  }
  return held;
}

function renderFeatChoices(feat, source, char, ctx) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: `${feat.name} (from ${source})` }));
  p.appendChild(el('p', { class: 'panel-note', text: feat.plain }));
  char.featChoices[feat.id] ||= {};
  const picks = char.featChoices[feat.id];

  for (const ch of feat.choices) {
    const g = ch.grant;
    p.appendChild(el('h4', { text: ch.label, style: 'margin-top:14px' }));

    if (g.type === 'spell') {
      const isCantrip = g.spellLevel === 0;
      const key = isCantrip ? 'cantrips' : 'spell';
      picks[key] ||= isCantrip ? [] : null;
      const cur = asArray(picks[key]).filter(Boolean);

      // Spells this character already knows from anywhere else: species traits,
      // other feats, class features, and the class spells picked in step 6.
      const known = spellsKnownElsewhere(char, feat.id);

      p.appendChild(counter(cur.length, g.count, 'chosen'));
      const l = el('div', { class: 'checklist' });
      for (const s of spellsFor(g.list, g.spellLevel)) {
        const on = cur.includes(s.id);
        const alreadyFrom = known.get(s.id);
        l.appendChild(checkRow({
          label: s.name, sub: s.description,
          src: alreadyFrom ? `already known from ${alreadyFrom}` : s.school,
          checked: on,
          disabled: !!alreadyFrom || (!on && cur.length >= g.count),
          onToggle: () => {
            const arr = asArray(picks[key]).filter(Boolean);
            toggleCapped(arr, s.id, g.count);
            picks[key] = g.count === 1 ? (arr[0] ?? null) : arr;
            ctx.update();
          }
        }));
      }
      p.appendChild(l);
    } else if (g.type === 'ability') {
      const grid = el('div', { class: 'cards' });
      for (const a of g.from) {
        const ab = DATA.byId.ability[a];
        grid.appendChild(choiceCard({
          id: a, title: ab.name, compact: true, plain: ab.blurb,
          selected: picks.ability === a,
          onPick: v => { picks.ability = v; ctx.update(); }
        }));
      }
      p.appendChild(grid);
    } else if (g.type === 'tool') {
      // Tools only, drawn from one category (Crafter takes artisan's tools,
      // Musician takes instruments).
      picks.profs ||= [];
      const cur = picks.profs.filter(Boolean);
      p.appendChild(counter(cur.length, g.count, 'chosen'));
      const l = el('div', { class: 'checklist' });
      const pool = Array.isArray(g.from)
        ? g.from
        : (DATA.equipment.toolCategories[g.from] || []);
      for (const t of pool) {
        const on = cur.includes(t);
        l.appendChild(checkRow({
          label: t, src: 'tool', checked: on,
          disabled: !on && cur.length >= g.count,
          onToggle: () => { toggleCapped(picks.profs, t, g.count); ctx.update(); }
        }));
      }
      p.appendChild(l);
    } else if (g.type === 'skillOrTool') {
      picks.profs ||= [];
      const cur = picks.profs.filter(Boolean);

      // Proficiency you already have is not worth taking twice, so anything
      // granted by the class, background, species or another feat is locked.
      const had = profsHeldElsewhere(char, feat.id);

      p.appendChild(counter(cur.length, g.count, 'chosen'));
      const l = el('div', { class: 'checklist' });
      for (const s of DATA.rules.skills) {
        const on = cur.includes(s.id);
        const from = had.get(s.id);
        l.appendChild(checkRow({
          label: s.name, sub: s.blurb,
          src: from ? `already from ${from}` : DATA.byId.ability[s.ability].short,
          checked: on, disabled: !!from || (!on && cur.length >= g.count),
          onToggle: () => { toggleCapped(picks.profs, s.id, g.count); ctx.update(); }
        }));
      }
      for (const [, tools] of Object.entries(DATA.equipment.toolCategories)) {
        for (const t of tools) {
          const on = cur.includes(t);
          const from = had.get(t);
          l.appendChild(checkRow({
            label: t, src: from ? `already from ${from}` : 'tool',
            checked: on, disabled: !!from || (!on && cur.length >= g.count),
            onToggle: () => { toggleCapped(picks.profs, t, g.count); ctx.update(); }
          }));
        }
      }
      p.appendChild(l);
    }
  }
  return p;
}

function renderEquipment(char, ctx, cls, bg) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: 'Starting equipment' }));
  p.appendChild(el('p', { class: 'panel-note', text: 'Take the ready-made kit unless you know exactly what you want. The kits are balanced and already include everything you need.' }));

  p.appendChild(el('h4', { text: `From your class (${cls.name})` }));
  const cg = el('div', { class: 'cards' });
  for (const opt of cls.startingEquipment) {
    cg.appendChild(choiceCard({
      id: opt.id,
      title: opt.label,
      plain: opt.items.length ? opt.items.join(', ') + (opt.gp ? `, and ${opt.gp} GP` : '') : `${opt.gp} GP to spend`,
      meta: [pill(opt.note, opt.items.length ? 'good' : 'warn')],
      selected: char.equipmentChoice.class === opt.id,
      onPick: v => { char.equipmentChoice.class = v; ctx.update(); }
    }));
  }
  p.appendChild(cg);

  if (bg && bg.equipment) {
    p.appendChild(el('h4', { text: `From your background (${bg.name})`, style: 'margin-top:16px' }));
    const bgrid = el('div', { class: 'cards' });
    for (const [key, opt] of Object.entries(bg.equipment)) {
      bgrid.appendChild(choiceCard({
        id: key,
        title: key === 'a' ? 'Take the gear' : 'Take 50 GP instead',
        plain: opt.items.length ? opt.items.join(', ') + (opt.gp ? `, and ${opt.gp} GP` : '') : `${opt.gp} GP`,
        compact: true,
        selected: char.equipmentChoice.background === key,
        onPick: v => { char.equipmentChoice.background = v; ctx.update(); }
      }));
    }
    p.appendChild(bgrid);
  }

  const { items, gp } = startingItems(char);
  if (items.length || gp) {
    p.appendChild(el('h4', { text: 'What you are carrying', style: 'margin-top:16px' }));
    const ul = el('ul', { style: 'font-size:.9rem;columns:2;column-gap:24px' });
    for (const it of items) ul.appendChild(el('li', { text: it.name }));
    if (gp) ul.appendChild(el('li', {}, el('b', { text: `${gp} GP` })));
    p.appendChild(ul);

    // Expand any packs so new players know what is inside.
    for (const it of items) {
      const pack = DATA.byId.pack[it.name];
      if (!pack) continue;
      p.appendChild(el('p', { class: 'muted', style: 'font-size:.82rem',
        text: `${pack.name} contains: ${pack.contents.join(', ')}.` }));
    }
  }
  return p;
}

/* ============================ 6. SPELLS ============================ */

export function renderSpells(root, char, ctx) {
  const cls = char.classId ? DATA.byId.class[char.classId] : null;

  root.appendChild(head('Step 6: Spells',
    'Choose the magic your character can cast. Cantrips are free and unlimited; levelled spells cost a spell slot.'));

  if (!cls) { root.appendChild(notice('warn', 'Pick a class first', 'Go back to step 1.')); return; }

  const d = derive(char);
  const bonus = d.bonusSpells;

  // A spell already granted by a species trait, an Origin feat or a class
  // feature cannot be picked again: knowing Fire Bolt from Magic Initiate does
  // not let a Wizard take it a second time as a class cantrip.
  const known = new Map();
  for (const b of bonus) if (!known.has(b.spell.id)) known.set(b.spell.id, b.source);

  // If a grant appeared after the spell was already picked (the player went back
  // and changed a feat), drop the now-duplicate pick rather than leaving it.
  let pruned = false;
  for (const key of ['cantrips', 'prepared', 'spellbook']) {
    const before = char.spells[key].length;
    char.spells[key] = char.spells[key].filter(id => !known.has(id));
    if (char.spells[key].length !== before) pruned = true;
  }
  if (pruned) ctx.silentSave?.();

  if (!cls.spellcasting) {
    root.appendChild(notice('tip', `${cls.name}s do not cast spells at level 1`,
      'That is a good thing while you are learning. Your turns stay simple: move, attack, use a feature.'));
    if (bonus.length) {
      root.appendChild(renderBonusSpells(bonus));
    } else {
      root.appendChild(el('div', { class: 'panel' },
        el('p', { class: 'muted', text: 'Nothing to choose here. Move on to your finished character sheet.' })));
    }
    return;
  }

  const sc = d.spellcasting;

  // Explainer
  const ex = el('div', { class: 'panel' });
  ex.appendChild(el('h3', { text: 'How your magic works' }));
  const facts = el('div', { class: 'sumgrid' });
  const f = (k, v) => facts.appendChild(el('div', { class: 'sumitem' },
    el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })));
  f('Spellcasting ability', sc.abilityName);
  f('Spell save DC', String(sc.saveDC));
  f('Spell attack bonus', fmt(sc.attackBonus));
  f('Cantrips', String(sc.cantripsKnown));
  f('Level 1 slots', String(sc.slots['1']));
  f('Slots come back on', sc.slotRecharge || 'a Long Rest');
  f('Spellcasting focus', sc.focus);
  ex.appendChild(facts);
  ex.appendChild(el('p', { class: 'panel-note', style: 'margin-top:12px',
    text: `Enemies resisting your spells must beat DC ${sc.saveDC}. When a spell needs an attack roll, you add ${fmt(sc.attackBonus)}.` }));
  root.appendChild(ex);

  if (sc.prepareStyle === 'pact') {
    root.appendChild(notice('', 'Pact Magic is different',
      `You only get ${sc.slots['1']} spell slot, but it comes back on a Short Rest, not just a Long Rest. Over a full adventuring day you cast more than the slot count suggests.`));
  }

  // Cantrips
  if (sc.cantripsKnown > 0) {
    root.appendChild(spellPicker({
      title: 'Cantrips',
      note: 'Cantrips cost nothing and never run out. Take at least one that deals damage so you always have something to do on your turn.',
      list: sc.list, level: 0, need: sc.cantripsKnown,
      selected: char.spells.cantrips,
      known,
      recommended: sc.recommended?.cantrips || [],
      onToggle: id => { toggleCapped(char.spells.cantrips, id, sc.cantripsKnown); ctx.update(); }
    }));
  }

  // Spellbook (wizard) then prepared
  if (sc.prepareStyle === 'spellbook') {
    root.appendChild(spellPicker({
      title: 'Your spellbook',
      note: `Write ${sc.spellbookSpells} level 1 spells into your book. These are yours permanently, even the ones you do not prepare today.`,
      list: sc.list, level: 1, need: sc.spellbookSpells,
      selected: char.spells.spellbook,
      known,
      recommended: sc.recommended?.spellbook || [],
      onToggle: id => {
        toggleCapped(char.spells.spellbook, id, sc.spellbookSpells);
        char.spells.prepared = char.spells.prepared.filter(s => char.spells.spellbook.includes(s));
        ctx.update();
      }
    }));

    if (char.spells.spellbook.length) {
      root.appendChild(spellPicker({
        title: 'Prepared today',
        note: `Choose ${sc.preparedSpells} spells from your book to have ready. You can swap these after every Long Rest.`,
        onlyIds: char.spells.spellbook,
        list: sc.list, level: 1, need: sc.preparedSpells,
        selected: char.spells.prepared,
        known,
        onToggle: id => { toggleCapped(char.spells.prepared, id, sc.preparedSpells); ctx.update(); }
      }));
    }
  } else {
    root.appendChild(spellPicker({
      title: 'Level 1 spells',
      note: sc.changeWhen === 'Long Rest'
        ? `Choose ${sc.preparedSpells}. You can change this whole list after every Long Rest, so nothing here is permanent.`
        : `Choose ${sc.preparedSpells}. You can swap one each time you level up, so pick carefully.`,
      list: sc.list, level: 1, need: sc.preparedSpells,
      selected: char.spells.prepared,
      known,
      recommended: sc.recommended?.spells || [],
      onToggle: id => { toggleCapped(char.spells.prepared, id, sc.preparedSpells); ctx.update(); }
    }));
  }

  if (bonus.length) root.appendChild(renderBonusSpells(bonus));
}

function renderBonusSpells(bonus) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: 'Extra spells you already have' }));
  p.appendChild(el('p', { class: 'panel-note', text: 'These come from your species, background feat or class feature. They are free and do not count against the numbers above.' }));
  for (const b of bonus) {
    const kindLabel = b.kind === 'cantrip' ? 'Cantrip, at will'
      : b.kind === 'always' ? 'Always prepared'
      : 'Free once per Long Rest';
    p.appendChild(el('div', { class: 'featureblock' },
      el('h4', {}, b.spell.name, ' ', pill(kindLabel, 'good'), ' ', pill(`from ${b.source}`)),
      el('p', { text: b.spell.description })));
  }
  return p;
}

/** First sentence of a spell, which is almost always the "what it does" line.
 *  Falls back to a trimmed opening when a spell leads with a long clause. */
function spellSummary(desc) {
  if (!desc) return '';
  const first = desc.split(/(?<=\.)\s+(?=[A-Z])/)[0] || desc;
  if (first.length <= 190) return first;
  const cut = first.slice(0, 185);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

/* A few casting times are a whole sentence: "Reaction, which you take when you
   are hit by an attack roll...". Squeezed into a pill that is an unreadable
   lozenge, so the action itself stays a pill and the condition becomes a
   Trigger line under it. That is also the order a player needs to read it in:
   what the spell costs, then when you are allowed to spend it. */
export function splitCastingTime(ct) {
  const m = /^(.+?),\s*which you take\s+(.+)$/i.exec(ct || '');
  if (!m) return [ct, null];
  const trigger = m[2].trim();
  return [m[1].trim(), trigger.charAt(0).toUpperCase() + trigger.slice(1)];
}

/** A short summary by default, with the full rules text one tap away.
 *  Browsing 30 spells is impossible if each one is six lines of rules text. */
function spellBody(s) {
  const wrap = el('div');
  const summary = spellSummary(s.description);
  const hasMore = summary !== s.description || s.higherLevel;

  wrap.appendChild(el('p', { class: 'spell-desc', text: summary }));
  if (!hasMore) return wrap;

  const full = el('div', { class: 'spell-full', hidden: true });
  full.appendChild(el('p', { class: 'spell-desc' }, glossify(s.description)));
  if (s.higherLevel) {
    full.appendChild(el('p', { class: 'spell-desc', style: 'margin-top:5px' },
      el('b', { text: 'Higher level: ' }), s.higherLevel));
  }

  const btn = el('button', {
    type: 'button', class: 'spell-more', 'aria-expanded': 'false',
    onClick: e => {
      e.stopPropagation(); e.preventDefault();
      const open = full.hidden;
      full.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.replaceChildren(el('span', { class: 'chev', text: open ? '▲' : '▼' }),
        open ? ' Hide full rules' : ' Full rules');
    }
  }, el('span', { class: 'chev', text: '▼' }), ' Full rules');

  wrap.appendChild(btn);
  wrap.appendChild(full);
  return wrap;
}

/** Reusable spell chooser with search and filters. */
function spellPicker({ title, note, list, level, need, selected, onToggle, recommended = [], onlyIds, known = new Map() }) {
  const p = el('div', { class: 'panel' });
  p.appendChild(el('h3', { text: title }));
  p.appendChild(el('p', { class: 'panel-note', text: note }));
  p.appendChild(counter(selected.length, need, 'chosen'));

  let all = spellsFor(list, level);
  if (onlyIds) all = all.filter(s => onlyIds.includes(s.id));

  const state = { q: '', filter: 'all' };
  const results = el('div', { class: 'checklist', style: 'grid-template-columns:repeat(auto-fill,minmax(280px,1fr))' });

  const bar = el('div', { class: 'spellbar' },
    el('input', {
      type: 'text', placeholder: 'Search spells…', 'aria-label': 'Search spells',
      onInput: e => { state.q = e.target.value.toLowerCase(); paint(); }
    }),
    (() => {
      const sel = el('select', { 'aria-label': 'Filter spells', onChange: e => { state.filter = e.target.value; paint(); } });
      for (const [v, t] of [['all', 'All spells'], ['selected', 'Only my picks'], ['recommended', 'Recommended'],
                            ['damage', 'Deals damage'], ['healing', 'Healing'], ['concentration', 'No concentration'], ['ritual', 'Ritual']]) {
        sel.appendChild(el('option', { value: v, text: t }));
      }
      return sel;
    })()
  );
  p.appendChild(bar);

  function matches(s) {
    if (state.q && !(s.name.toLowerCase().includes(state.q) || s.description.toLowerCase().includes(state.q) || s.school.toLowerCase().includes(state.q))) return false;
    switch (state.filter) {
      case 'selected': return selected.includes(s.id);
      case 'recommended': return recommended.includes(s.id);
      case 'damage': return /\bdamage\b/i.test(s.description);
      case 'healing': return /regain|Hit Points|heal/i.test(s.description);
      case 'concentration': return !s.concentration;
      case 'ritual': return s.ritual;
      default: return true;
    }
  }

  function paint() {
    results.replaceChildren();
    const shown = all.filter(matches);
    if (!shown.length) {
      results.appendChild(el('p', { class: 'muted', text: 'No spells match that search.' }));
      return;
    }
    for (const s of shown) {
      const on = selected.includes(s.id);
      const alreadyFrom = known.get(s.id);
      const card = el('div', {
        class: `spell${on ? ' on' : ''}${alreadyFrom ? ' locked' : ''}`,
        role: 'button', tabindex: alreadyFrom ? '-1' : '0',
        'aria-pressed': on ? 'true' : 'false',
        'aria-disabled': alreadyFrom ? 'true' : null
      });
      const act = e => {
        if (e.target.closest('.spell-more')) return;
        if (alreadyFrom) return;               // already known from another source
        if (!on && selected.length >= need) return;
        onToggle(s.id);
      };
      card.addEventListener('click', act);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e); } });

      card.appendChild(el('div', { class: 'spell-head' },
        el('span', { class: 'sname', text: s.name }),
        el('span', { class: 'sschool', text: s.school }),
        alreadyFrom ? pill(`Already known from ${alreadyFrom}`, 'info') : null,
        !alreadyFrom && recommended.includes(s.id) ? pill('Recommended', 'good') : null,
        on ? pill('✓ chosen', 'accent') : null));

      const [castAction, castTrigger] = splitCastingTime(s.castingTime);
      const meta = el('div', { class: 'spell-meta' },
        pill(castAction), pill(s.range), pill(s.duration));
      if (s.concentration) meta.appendChild(pill('Concentration', 'warn'));
      if (s.ritual) meta.appendChild(pill('Ritual', 'info'));
      if (s.material) meta.appendChild(pill('Needs a material', 'warn'));
      card.appendChild(meta);
      if (castTrigger) {
        card.appendChild(el('p', { class: 'spell-trigger' },
          el('b', { text: 'Trigger: ' }), glossify(castTrigger)));
      }
      card.appendChild(spellBody(s));
      results.appendChild(card);
    }
  }
  paint();
  p.appendChild(results);
  return p;
}
