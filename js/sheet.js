/* Step 7: the finished level 1 character sheet, laid out the way a tabletop
   sheet is: ruled boxes, ability scores down the left, combat across the top
   of the right column, features and spells below.

   Everything is derived from the character. The handful of fields that change
   during play (current HP, temporary HP, death saves, spent spell slots) are
   editable and stored on char.play. */

import { DATA } from './data.js';
import { el, notice } from './ui.js';
import { ABILS, fmt, derive, stepIssues } from './rules.js';
import { STEPS } from './steps.js';

/* True when the page runs inside another page's frame, which is how a published
   artifact is viewed. That frame refuses window.print() and page-initiated
   downloads, so those affordances are swapped for copy-and-paste. */
const EMBEDDED = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

export function renderSheet(root, char, ctx) {
  // Anything still unfinished blocks a clean sheet; say exactly what and where.
  const blocking = [];
  for (const s of STEPS) {
    if (s.id === 'sheet') continue;
    const issues = stepIssues(char, s.id);
    if (issues.length) blocking.push({ step: s, issues });
  }

  if (blocking.length) {
    root.appendChild(el('div', { class: 'step-head' },
      el('h2', { text: 'Almost there' }),
      el('p', { class: 'lede', text: 'A few things still need choosing before the sheet is complete.' })));

    for (const b of blocking) {
      const p = el('div', { class: 'panel' });
      p.appendChild(el('h3', { text: `Step ${b.step.num}: ${b.step.label}` }));
      const ul = el('ul');
      for (const i of b.issues) ul.appendChild(el('li', { text: i }));
      p.appendChild(ul);
      p.appendChild(el('button', {
        type: 'button', class: 'btn primary', text: `Go to step ${b.step.num}`,
        onClick: () => ctx.goto(b.step.id)
      }));
      root.appendChild(p);
    }
    return;
  }

  const d = derive(char);
  char.play ||= {};
  char.play.coins ||= { cp: '', sp: '', ep: '', gp: '', pp: '' };
  const play = char.play;
  const saveQuiet = () => ctx.silentSave?.();

  /* ---------------- action bar ---------------- */
  const actions = el('div', { class: 'sheet-actions' });
  if (!EMBEDDED) {
    actions.appendChild(el('button', { type: 'button', class: 'btn primary', text: 'Print / Save as PDF', onClick: () => window.print() }));
    actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Download as text', onClick: () => downloadText(char, d) }));
  }
  actions.appendChild(el('button', { type: 'button', class: 'btn' + (EMBEDDED ? ' primary' : ''), text: 'Copy summary', onClick: e => copySummary(char, d, e.target) }));
  if (EMBEDDED) {
    actions.appendChild(el('button', {
      type: 'button', class: 'btn', text: 'Show as text',
      onClick: e => {
        const box = root.querySelector('#sheet-text');
        const open = box.hidden;
        box.hidden = !open;
        e.target.textContent = open ? 'Hide text' : 'Show as text';
        if (open) { box.value = sheetText(char, d); box.focus(); box.select(); }
      }
    }));
  }
  root.appendChild(actions);

  if (EMBEDDED) {
    root.appendChild(el('textarea', {
      id: 'sheet-text', hidden: true, readonly: true, rows: '18',
      'aria-label': 'Character sheet as plain text, ready to copy',
      style: 'width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem;margin-bottom:16px'
    }));
  }

  const cs = el('div', { class: 'csheet' });

  /* ---------------- masthead ---------------- */
  const nameInput = el('input', {
    type: 'text', id: 'cs-charname', value: char.name,
    placeholder: 'Character name', 'aria-label': 'Character name',
    onInput: e => { char.name = e.target.value; saveQuiet(); }
  });
  const idField = (k, v) => el('div', { class: 'cs-id' },
    el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k }));

  // One compact row. Speed and Hit Dice moved to the combat and hit point
  // rows, where they are actually used, rather than padding the masthead out.
  cs.appendChild(el('div', { class: 'cs-head' },
    el('div', { class: 'cs-name' }, nameInput,
      el('div', { class: 'k', text: 'Character name' })),
    idField('Class & Level', `${d.cls.name} 1`),
    idField('Species', d.sp.name),
    idField('Background', d.bg.name),
    idField('Size', d.size)
  ));

  /* ---------------- body: abilities | everything else ---------------- */
  const body = el('div', { class: 'cs-body' });
  const leftCol = el('div');
  const rightCol = el('div', { class: 'cs-right' });

  /* --- ability score boxes --- */
  const abils = el('div', { class: 'cs-abils' });
  for (const a of ABILS) {
    abils.appendChild(el('div', { class: 'cs-abil' },
      el('div', { class: 'k', text: DATA.byId.ability[a].name }),
      el('div', { class: 'm', text: fmt(d.mods[a]) }),
      el('div', { class: 's', text: String(d.abilities[a]) })));
  }
  leftCol.appendChild(abils);

  /* --- saving throws --- */
  const saveSec = el('div', { class: 'cs-sec', style: 'margin-top:10px' },
    el('h3', { text: 'Saving Throws' }));
  const saveList = el('ul', { class: 'cs-list' });
  for (const s of d.saves) {
    saveList.appendChild(el('li', {},
      el('span', { class: `dot${s.proficient ? ' on' : ''}`, 'aria-hidden': 'true' }),
      el('span', { class: 'nm', text: s.name }),
      el('span', { class: 'mod', text: fmt(s.mod) })));
  }
  saveSec.appendChild(saveList);
  leftCol.appendChild(saveSec);

  /* --- skills --- */
  const skillSec = el('div', { class: 'cs-sec', style: 'margin-top:10px' },
    el('h3', { text: 'Skills' }));
  const skillList = el('ul', { class: 'cs-list', id: 'cs-skills' });
  for (const s of d.skills) {
    const cls = s.expertise ? 'dot on exp' : s.proficient ? 'dot on' : 'dot';
    skillList.appendChild(el('li', { title: s.sources.length ? `From ${s.sources.join(', ')}` : '' },
      el('span', { class: cls, 'aria-hidden': 'true' }),
      el('span', { class: 'nm', text: s.name }),
      el('span', { class: 'ab', text: DATA.byId.ability[s.ability].short }),
      el('span', { class: 'mod', text: fmt(s.mod) })));
  }
  skillSec.appendChild(skillList);
  skillSec.appendChild(el('p', { class: 'cs-inline', style: 'margin-top:6px;color:var(--text-dim);font-size:.68rem',
    text: 'Filled dot = proficient. Red dot = expertise (double bonus).' }));
  leftCol.appendChild(skillSec);

  /* --- combat row --- */
  const stat = (label, value, sub, extraClass) => el('div', { class: `bx${extraClass ? ' ' + extraClass : ''}` },
    el('div', { class: 'bx-v', text: value }),
    el('div', { class: 'bx-t', text: label }),
    sub ? el('div', { class: 'bx-t', style: 'font-size:.56rem;opacity:.8', text: sub }) : null);

  rightCol.appendChild(el('div', { class: 'cs-combat' },
    stat('Armor Class', String(d.ac), null, 'cs-shield'),
    stat('Initiative', fmt(d.initiative)),
    stat('Speed', `${d.speed}`, 'feet'),
    stat('Proficiency', fmt(d.pb)),
    stat('Passive Perception', String(d.passivePerception)),
    d.spellcasting ? stat('Spell Save DC', String(d.spellcasting.saveDC)) : stat('Size', d.size)
  ));

  /* --- hit points --- */
  const hpMax = d.hp;
  // Both hit point fields start blank. They are the boxes a player writes in
  // and erases during play, so the sheet must not pre-fill them.
  const curInput = el('input', {
    type: 'number', class: 'cur', id: 'cs-curhp', value: play.currentHp ?? '', min: '0',
    'aria-label': 'Current hit points',
    onInput: e => { play.currentHp = e.target.value; saveQuiet(); }
  });
  const tempInput = el('input', {
    type: 'number', class: 'temp', id: 'cs-temphp', value: play.tempHp ?? '', min: '0',
    'aria-label': 'Temporary hit points',
    onInput: e => { play.tempHp = e.target.value; saveQuiet(); }
  });

  const deathRow = (kind, count, max, label) => {
    const row = el('div', { class: `row ${kind}` }, el('span', { text: label }));
    for (let i = 1; i <= max; i++) {
      row.appendChild(el('button', {
        type: 'button', class: `pip${i <= count ? ' on' : ''}`,
        'aria-label': `${label} ${i}`, 'aria-pressed': i <= count ? 'true' : 'false',
        onClick: () => {
          const key = kind === 'succ' ? 'deathSuccess' : 'deathFail';
          play[key] = play[key] === i ? i - 1 : i;
          ctx.update();
        }
      }));
    }
    return row;
  };

  rightCol.appendChild(el('div', { class: 'cs-hp' },
    el('div', { class: 'bx' },
      el('div', { class: 'hpmain' }, curInput, el('span', { class: 'max', text: `/ ${hpMax}` })),
      el('div', { class: 'bx-t', text: 'Hit Points' }),
      el('div', { class: 'bx-t', style: 'font-size:.56rem;opacity:.8', text: `max ${hpMax}` })),
    el('div', { class: 'bx' },
      tempInput,
      el('div', { class: 'bx-t', text: 'Temp HP' })),
    el('div', { class: 'bx' },
      el('div', { class: 'bx-v', style: 'font-size:1.25rem', text: d.hitDie }),
      el('div', { class: 'bx-t', text: 'Hit Dice' }),
      el('div', { class: 'bx-t', style: 'font-size:.56rem;opacity:.8', text: `spend on a short rest` })),
    el('div', { class: 'bx' },
      el('div', { class: 'cs-deaths' },
        deathRow('succ', play.deathSuccess || 0, 3, 'Successes'),
        deathRow('fail', play.deathFail || 0, 3, 'Failures')),
      el('div', { class: 'bx-t', style: 'margin-top:6px', text: 'Death Saves' }))
  ));

  /* --- attacks --- */
  if (d.attacks.length) {
    const sec = el('div', { class: 'cs-sec' }, el('h3', { text: 'Attacks' }));
    const noteFor = a => (a.mastery ? a.mastery.name : a.properties.slice(0, 2).join(', '));
    // Only show the Notes column when at least one weapon has something to say.
    const anyNotes = d.attacks.some(a => noteFor(a));
    const t = el('table', { class: 'cs-tbl' });
    t.appendChild(el('tr', {},
      el('th', { text: 'Weapon' }), el('th', { class: 'num', text: 'Hit' }),
      el('th', { text: 'Damage' }), anyNotes ? el('th', { text: 'Notes' }) : null));
    for (const a of d.attacks) {
      t.appendChild(el('tr', {},
        el('td', { class: 'nm', text: a.name }),
        el('td', { class: 'num', text: fmt(a.atk) }),
        el('td', { text: `${a.damage} ${a.damageType}` }),
        anyNotes ? el('td', { class: 'tag', text: noteFor(a) }) : null));
    }
    sec.appendChild(t);
    sec.appendChild(el('p', { class: 'cs-inline', style: 'margin-top:6px;color:var(--text-dim);font-size:.7rem',
      text: "Roll d20 + Hit against the target's AC. Meet or beat it, then roll damage." }));
    rightCol.appendChild(sec);
  }

  /* --- spellcasting --- */
  if (d.spellcasting) {
    const sc = d.spellcasting;
    const sec = el('div', { class: 'cs-sec tall' }, el('h3', { text: 'Spellcasting' }));

    sec.appendChild(el('p', { class: 'cs-inline' },
      el('b', { text: sc.abilityName }), ' · Save DC ', el('b', { text: String(sc.saveDC) }),
      ' · Attack ', el('b', { text: fmt(sc.attackBonus) }), ' · Focus: ', sc.focus));

    // Spell slot pips, clickable so a player can track what they have spent.
    const total = sc.slots['1'];
    const used = Math.min(play.slotsUsed || 0, total);
    const pips = el('div', { class: 'cs-slots' });
    for (let i = 1; i <= total; i++) {
      pips.appendChild(el('button', {
        type: 'button', class: `cs-slot${i <= used ? ' on' : ''}`,
        'aria-label': `Level 1 spell slot ${i}`, 'aria-pressed': i <= used ? 'true' : 'false',
        onClick: () => { play.slotsUsed = used === i ? i - 1 : i; ctx.update(); }
      }));
    }
    sec.appendChild(el('div', { class: 'cs-inline', style: 'display:flex;align-items:center;gap:8px;margin-top:6px' },
      el('b', { text: `Level 1 slots (${total}):` }), pips,
      el('span', { style: 'color:var(--text-dim);font-size:.7rem', text: `back on ${sc.slotRecharge || 'a Long Rest'}` })));

    const spellRow = (labelText, ids) => {
      if (!ids.length) return null;
      const names = ids.map(id => DATA.byId.spell[id]?.name).filter(Boolean).join(', ');
      return el('p', { class: 'cs-inline' }, el('b', { text: labelText + ': ' }), names);
    };
    const cantripRow = spellRow('Cantrips (at will)', char.spells.cantrips);
    if (cantripRow) sec.appendChild(cantripRow);
    const prepRow = spellRow('Prepared', char.spells.prepared);
    if (prepRow) sec.appendChild(prepRow);
    if (char.spells.spellbook.length) {
      const unprepped = char.spells.spellbook.filter(id => !char.spells.prepared.includes(id));
      const bookRow = spellRow('Also in spellbook', unprepped);
      if (bookRow) sec.appendChild(bookRow);
    }
    for (const b of d.bonusSpells) {
      sec.appendChild(el('p', { class: 'cs-inline', style: 'color:var(--text-dim)' },
        el('b', { text: b.spell.name }),
        ` — ${b.kind === 'cantrip' ? 'at will' : b.kind === 'always' ? 'always prepared' : 'free once per Long Rest'} (${b.source})`));
    }
    rightCol.appendChild(sec);
  } else if (d.bonusSpells.length) {
    const sec = el('div', { class: 'cs-sec' }, el('h3', { text: 'Magic' }));
    for (const b of d.bonusSpells) {
      sec.appendChild(el('p', { class: 'cs-inline' },
        el('b', { text: b.spell.name }),
        ` — ${b.kind === 'cantrip' ? 'at will' : b.kind === 'always' ? 'always prepared' : 'free once per Long Rest'} (${b.source})`));
    }
    rightCol.appendChild(sec);
  }

  /* --- features & traits --- */
  const featSec = el('div', { class: 'cs-sec tall' }, el('h3', { text: 'Features & Traits' }));
  const featWrap = el('div', { class: 'cs-cols2' });

  for (const f of [...(d.cls.features || []), ...(d.cls.extraFeatures || [])]) {
    let extra = '';
    const chosenId = f.choice ? char.classChoices[f.choice.id] : null;
    if (chosenId && f.choice?.options) {
      const o = f.choice.options.find(x => x.id === chosenId);
      if (o) extra = `: ${o.name}`;
    } else if (Array.isArray(chosenId) && chosenId.length) {
      extra = `: ${chosenId.join(', ')}`;
    } else if (chosenId && DATA.byId.feat[chosenId]) {
      extra = `: ${DATA.byId.feat[chosenId].name}`;
    }
    featWrap.appendChild(el('div', { class: 'cs-feat' },
      el('h4', {}, f.name + extra, el('span', { class: 'from', text: ` · ${d.cls.name}` })),
      el('p', { text: f.plain })));
  }
  for (const t of d.sp.traits) {
    featWrap.appendChild(el('div', { class: 'cs-feat' },
      el('h4', {}, t.name, el('span', { class: 'from', text: ` · ${d.sp.name}` })),
      el('p', { text: t.plain })));
  }
  for (const { feat, source } of d.feats) {
    featWrap.appendChild(el('div', { class: 'cs-feat' },
      el('h4', {}, feat.name, el('span', { class: 'from', text: ` · feat from ${source}` })),
      el('p', { text: feat.plain })));
  }
  featSec.appendChild(featWrap);

  // Features, proficiencies and equipment go in a full-width block below the
  // stat block, which both reads better on screen and gives print a clean
  // second page instead of splitting the two columns mid-flow.
  const extra = el('div', { class: 'cs-extra' });
  extra.appendChild(featSec);

  /* --- weapon mastery --- */
  if (d.masteries.length) {
    const sec = el('div', { class: 'cs-sec' }, el('h3', { text: 'Weapon Mastery' }));
    for (const m of d.masteries) {
      sec.appendChild(el('div', { class: 'cs-feat' },
        el('h4', { text: `${m.weapon}: ${m.mastery.name}` }),
        el('p', { text: m.mastery.plain })));
    }
    extra.appendChild(sec);
  }

  /* --- proficiencies + equipment, side by side --- */
  const langs = ['Common'];
  if (char.classChoices.language) langs.push(char.classChoices.language);
  if (d.cls.id === 'rogue') langs.push("Thieves' Cant");
  if (d.cls.id === 'druid') langs.push('Druidic');

  const profSec = el('div', { class: 'cs-sec' }, el('h3', { text: 'Proficiencies & Languages' }));
  profSec.appendChild(el('p', { class: 'cs-inline' }, el('b', { text: 'Armor: ' }), d.cls.armorTraining));
  profSec.appendChild(el('p', { class: 'cs-inline' }, el('b', { text: 'Weapons: ' }), d.cls.weaponProficiencies));
  if (d.tools.length) profSec.appendChild(el('p', { class: 'cs-inline' }, el('b', { text: 'Tools: ' }), d.tools.map(t => t.name).join(', ')));
  profSec.appendChild(el('p', { class: 'cs-inline' }, el('b', { text: 'Languages: ' }), langs.join(', '),
    el('span', { style: 'color:var(--text-dim)', text: ' (plus two more, ask your DM)' })));
  if (d.darkvision) profSec.appendChild(el('p', { class: 'cs-inline' }, el('b', { text: 'Darkvision: ' }), `${d.darkvision} ft`));
  if (d.resistances.length) profSec.appendChild(el('p', { class: 'cs-inline' }, el('b', { text: 'Resistances: ' }), d.resistances.join(', '),
    el('span', { style: 'color:var(--text-dim)', text: ' (that damage is halved)' })));

  const eqSec = el('div', { class: 'cs-sec' }, el('h3', { text: 'Equipment' }));
  const eqList = el('ul', { class: 'cs-list', style: 'font-size:.76rem' });
  // A class kit and a background kit can both grant the same item (two Holy
  // Symbols, for instance). Show one row with a count rather than a repeat.
  const counts = new Map();
  for (const it of d.items) counts.set(it.name, (counts.get(it.name) || 0) + 1);
  for (const [name, n] of counts) {
    eqList.appendChild(el('li', {},
      el('span', { class: 'nm', text: name }),
      n > 1 ? el('span', { class: 'mod', text: `×${n}` }) : null));
  }
  if (d.gp) eqList.appendChild(el('li', {}, el('span', { class: 'nm' }, el('b', { text: `${d.gp} GP` }))));
  eqSec.appendChild(eqList);
  for (const it of d.items) {
    const pack = DATA.byId.pack[it.name];
    if (pack) eqSec.appendChild(el('p', { class: 'cs-inline', style: 'color:var(--text-dim);font-size:.68rem;margin-top:5px',
      text: `${pack.name}: ${pack.contents.join(', ')}.` }));
  }

  // Proficiencies and equipment stay in the right column: they are short, they
  // balance the tall skills rail on screen, and on paper they belong on page 1
  // with the rest of what you need mid-combat.
  rightCol.appendChild(el('div', { class: 'cs-pair' }, profSec, eqSec));

  body.appendChild(leftCol);
  body.appendChild(rightCol);
  cs.appendChild(body);
  cs.appendChild(extra);

  /* ---------------- adventure log: room to write ----------------
     Starting gear is printed above and never changes. This page is for
     everything picked up afterwards, so it is deliberately mostly blank:
     ruled space to write in on paper, and textareas that save on screen. */
  const log = el('div', { class: 'cs-log' });

  const coinRow = el('div', { class: 'cs-coins' });
  for (const [key, label] of [['cp', 'Copper'], ['sp', 'Silver'], ['ep', 'Electrum'], ['gp', 'Gold'], ['pp', 'Platinum']]) {
    const input = el('input', {
      type: 'number', min: '0', id: `cs-coin-${key}`,
      value: play.coins[key] ?? '',
      'aria-label': `${label} pieces`,
      onInput: e => { play.coins[key] = e.target.value; saveQuiet(); }
    });
    coinRow.appendChild(el('div', { class: 'bx' }, input,
      el('div', { class: 'bx-t', text: label }),
      el('div', { class: 'bx-t', style: 'font-size:.55rem;opacity:.75', text: key.toUpperCase() })));
  }

  const ruled = (id, value, rows, label, onInput) => {
    const ta = el('textarea', {
      id, rows: String(rows), class: 'cs-ruled', spellcheck: 'false',
      'aria-label': label, onInput
    });
    ta.value = value || '';
    return ta;
  };

  const coinSec = el('div', { class: 'cs-sec' }, el('h3', { text: 'Coins' }), coinRow);
  coinSec.appendChild(el('p', { class: 'cs-inline', style: 'margin-top:6px;color:var(--text-dim);font-size:.68rem',
    text: d.gp ? `You started with ${d.gp} GP. Write your running total here.` : 'Write your running total here.' }));

  const itemSec = el('div', { class: 'cs-sec' },
    el('h3', { text: 'Items Found on the Journey' }),
    ruled('cs-founditems', play.foundItems, 16, 'Items found during play',
      e => { play.foundItems = e.target.value; saveQuiet(); }));

  const noteSec = el('div', { class: 'cs-sec' },
    el('h3', { text: 'Notes, Allies & Quests' }),
    ruled('cs-notes', play.notes, 16, 'Notes',
      e => { play.notes = e.target.value; saveQuiet(); }));

  log.appendChild(coinSec);
  log.appendChild(el('div', { class: 'cs-pair' }, itemSec, noteSec));
  cs.appendChild(log);

  root.appendChild(cs);

  /* ---------------- guidance below the sheet ---------------- */
  const guidance = el('div', { class: 'cs-print-hide', style: 'margin-top:18px' });
  guidance.appendChild(notice('tip', 'What to do on your first turn', firstTurnAdvice(d)));
  guidance.appendChild(notice('', 'Levelling up later',
    `At level 2 you gain more hit points and a new ${d.cls.name} feature. At level 3 you choose your subclass, which is the next big decision. This builder covers level 1; keep your sheet and come back when you level.`));
  root.appendChild(guidance);
}

function firstTurnAdvice(d) {
  const bits = [];
  if (d.attacks.length) {
    const best = d.attacks.reduce((a, b) => (b.atk > a.atk ? b : a));
    bits.push(`Move up to ${d.speed} feet, then attack with your ${best.name}: roll d20 ${fmt(best.atk)} against the target's AC, and on a hit roll ${best.damage} ${best.damageType} damage.`);
  }
  if (d.spellcasting) {
    bits.push(`Or cast a spell. Cantrips are free every turn; your ${d.spellcasting.slots['1']} slot${d.spellcasting.slots['1'] > 1 ? 's are' : ' is'} for the big moments.`);
  }
  if (d.cls.id === 'barbarian') bits.push('Before you attack, use your Bonus Action to Rage. It halves most damage coming at you.');
  if (d.cls.id === 'fighter') bits.push('If you drop low, Second Wind as a Bonus Action heals you and still lets you attack.');
  if (d.cls.id === 'rogue') bits.push('Try to attack a target that one of your friends is already next to. That triggers Sneak Attack for an extra 1d6.');
  return bits.join(' ');
}

/* ---------------- exports ---------------- */

function sheetText(char, d) {
  const L = [];
  L.push(`${char.name || 'Unnamed character'}`);
  L.push(`Level 1 ${d.sp.name} ${d.cls.name} · ${d.bg.name}`);
  L.push('');
  L.push(`AC ${d.ac} (${d.acHow})`);
  L.push(`HP ${d.hp}  |  Hit Dice ${d.hitDie}  |  Initiative ${fmt(d.initiative)}  |  Speed ${d.speed} ft  |  Proficiency ${fmt(d.pb)}`);
  L.push(`Size ${d.size}${d.darkvision ? `  |  Darkvision ${d.darkvision} ft` : ''}${d.resistances.length ? `  |  Resist ${d.resistances.join(', ')}` : ''}`);
  L.push('');
  L.push('ABILITY SCORES');
  L.push(ABILS.map(a => `${DATA.byId.ability[a].short} ${d.abilities[a]} (${fmt(d.mods[a])})`).join('   '));
  L.push('');
  L.push('SAVING THROWS');
  L.push(d.saves.map(s => `${s.proficient ? '*' : ' '}${s.name} ${fmt(s.mod)}`).join('   '));
  L.push('');
  L.push('SKILLS');
  for (const s of d.skills) {
    L.push(`${s.expertise ? '**' : s.proficient ? ' *' : '  '} ${s.name.padEnd(17)} ${fmt(s.mod)}${s.sources.length ? `   (${s.sources.join(', ')})` : ''}`);
  }
  if (d.attacks.length) {
    L.push('');
    L.push('ATTACKS');
    for (const a of d.attacks) L.push(`  ${a.name.padEnd(18)} hit ${fmt(a.atk)}   ${a.damage} ${a.damageType}${a.mastery ? `   [${a.mastery.name}]` : ''}`);
  }
  if (d.spellcasting) {
    const sc = d.spellcasting;
    L.push('');
    L.push('SPELLCASTING');
    L.push(`  ${sc.abilityName} · Save DC ${sc.saveDC} · Attack ${fmt(sc.attackBonus)} · ${sc.slots['1']} level 1 slot(s)`);
    if (char.spells.cantrips.length) L.push(`  Cantrips: ${char.spells.cantrips.map(i => DATA.byId.spell[i]?.name).filter(Boolean).join(', ')}`);
    if (char.spells.prepared.length) L.push(`  Prepared: ${char.spells.prepared.map(i => DATA.byId.spell[i]?.name).filter(Boolean).join(', ')}`);
    if (char.spells.spellbook.length) L.push(`  Spellbook: ${char.spells.spellbook.map(i => DATA.byId.spell[i]?.name).filter(Boolean).join(', ')}`);
  }
  if (d.bonusSpells.length) {
    L.push(`  Bonus spells: ${d.bonusSpells.map(b => `${b.spell.name} (${b.source})`).join(', ')}`);
  }
  L.push('');
  L.push('FEATURES');
  for (const f of [...(d.cls.features || []), ...(d.cls.extraFeatures || [])]) L.push(`  ${f.name}: ${f.plain}`);
  for (const t of d.sp.traits) L.push(`  ${t.name} (${d.sp.name}): ${t.plain}`);
  L.push('');
  L.push('FEATS');
  for (const { feat, source } of d.feats) L.push(`  ${feat.name} (${source}): ${feat.plain}`);
  L.push('');
  L.push('PROFICIENCIES');
  L.push(`  Armor: ${d.cls.armorTraining}`);
  L.push(`  Weapons: ${d.cls.weaponProficiencies}`);
  if (d.tools.length) L.push(`  Tools: ${d.tools.map(t => t.name).join(', ')}`);
  L.push('');
  L.push('EQUIPMENT');
  for (const it of d.items) L.push(`  ${it.name}`);
  if (d.gp) L.push(`  ${d.gp} GP`);
  L.push('');
  L.push('---');
  L.push('This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of');
  L.push('the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the');
  L.push('Creative Commons Attribution 4.0 International License, available at');
  L.push('https://creativecommons.org/licenses/by/4.0/legalcode.');
  return L.join('\n');
}

function downloadText(char, d) {
  const blob = new Blob([sheetText(char, d)], { type: 'text/plain;charset=utf-8' });
  const a = el('a', {
    href: URL.createObjectURL(blob),
    download: `${(char.name || 'character').replace(/[^\w\- ]+/g, '').trim() || 'character'}-level-1.txt`
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

async function copySummary(char, d, btn) {
  const text = sheetText(char, d);
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => { btn.textContent = label; }, 1600);
}
