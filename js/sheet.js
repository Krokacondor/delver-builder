/* Step 7: the finished level 1 character sheet. */

import { DATA } from './data.js';
import { el, pill, notice } from './ui.js';
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

  // Inside an embedded viewer (a published artifact) the frame refuses
  // window.print() and blocks downloads the page starts itself, so offer
  // copy-and-paste instead of buttons that would silently do nothing.
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

  const sheet = el('div', { class: 'sheet' });

  /* --- name + header --- */
  const nameInput = el('input', {
    type: 'text', value: char.name, placeholder: 'Name your character…',
    style: 'font-size:1.6rem;font-family:var(--font-head);font-weight:700;border:0;border-bottom:2px dashed var(--border);border-radius:0;padding:2px 0;background:none',
    onInput: e => { char.name = e.target.value; ctx.silentSave(); }
  });
  sheet.appendChild(el('div', { class: 'sheet-head' },
    el('div', { style: 'flex:1;min-width:240px' },
      nameInput,
      el('p', { class: 'sub', text: `Level 1 ${d.sp.name} ${d.cls.name}  ·  ${d.bg.name}` })),
    el('div', {},
      pill(`${d.size}`, 'info'), ' ',
      pill(`Speed ${d.speed} ft`, 'info'), ' ',
      d.darkvision ? pill(`Darkvision ${d.darkvision} ft`, 'info') : null)
  ));

  /* --- core stats --- */
  const stats = el('div', { class: 'statline' });
  const stat = (k, v, x) => stats.appendChild(el('div', { class: 'statbox' },
    el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }), x ? el('div', { class: 'x', text: x }) : null));
  stat('Armor Class', String(d.ac), d.acHow);
  stat('Hit Points', String(d.hp), `${d.hitDie} ${fmt(d.mods.con)} CON`);
  stat('Initiative', fmt(d.initiative), d.initiative !== d.mods.dex ? 'includes Alert' : 'DEX');
  stat('Proficiency', fmt(d.pb), 'add when trained');
  stat('Hit Dice', d.hitDie, 'spend on a short rest');
  stat('Passive Perception', String(d.passivePerception), 'what you notice');
  sheet.appendChild(stats);

  /* --- abilities --- */
  const ag = el('div', { class: 'abilgrid' });
  for (const a of ABILS) {
    ag.appendChild(el('div', { class: 'abilbox' },
      el('div', { class: 'k', text: DATA.byId.ability[a].short }),
      el('div', { class: 'm', text: fmt(d.mods[a]) }),
      el('div', { class: 's', text: String(d.abilities[a]) })));
  }
  sheet.appendChild(ag);

  const cols = el('div', { class: 'sheet-cols' });
  const left = el('div');
  const right = el('div');

  /* --- saving throws --- */
  const saveSec = section('Saving Throws');
  const stbl = el('table', { class: 'skilltable' });
  for (const s of d.saves) {
    stbl.appendChild(el('tr', { class: s.proficient ? 'trained' : '' },
      el('td', { class: 'prof', text: s.proficient ? '●' : '' }),
      el('td', { text: s.name }),
      el('td', { class: 'mod', text: fmt(s.mod) })));
  }
  saveSec.appendChild(stbl);
  saveSec.appendChild(el('p', { class: 'muted', style: 'font-size:.8rem;margin-top:6px',
    text: 'Filled dots are the two your class trains. Roll d20 and add the number.' }));
  left.appendChild(saveSec);

  /* --- skills --- */
  const skSec = section('Skills');
  const sk = el('table', { class: 'skilltable' });
  for (const s of d.skills) {
    sk.appendChild(el('tr', { class: s.proficient ? 'trained' : '' },
      el('td', { class: 'prof', text: s.expertise ? '◉' : s.proficient ? '●' : '' }),
      el('td', {}, s.name, el('span', { class: 'muted', text: ` (${DATA.byId.ability[s.ability].short})` }),
        s.sources.length ? el('span', { class: 'muted', style: 'font-size:.75rem', text: ` · ${s.sources.join(', ')}` }) : null),
      el('td', { class: 'mod', text: fmt(s.mod) })));
  }
  skSec.appendChild(sk);
  if (d.skills.some(s => s.expertise)) {
    skSec.appendChild(el('p', { class: 'muted', style: 'font-size:.8rem;margin-top:6px', text: '◉ means Expertise: double proficiency bonus.' }));
  }
  left.appendChild(skSec);

  /* --- attacks --- */
  if (d.attacks.length) {
    const atk = section('Attacks');
    const t = el('table', { class: 'skilltable' });
    t.appendChild(el('tr', {},
      el('td', {}, el('b', { text: 'Weapon' })),
      el('td', { class: 'mod' }, el('b', { text: 'Hit' })),
      el('td', {}, el('b', { text: 'Damage' }))));
    for (const a of d.attacks) {
      t.appendChild(el('tr', {},
        el('td', {}, a.name,
          a.mastery ? el('span', { class: 'muted', style: 'font-size:.75rem', text: ` · ${a.mastery.name}` }) : null),
        el('td', { class: 'mod', text: fmt(a.atk) }),
        el('td', { text: `${a.damage} ${a.damageType}` })));
    }
    atk.appendChild(t);
    atk.appendChild(el('p', { class: 'muted', style: 'font-size:.8rem;margin-top:6px',
      text: 'Roll d20 + Hit against the target’s AC. If you meet or beat it, roll the damage.' }));
    left.appendChild(atk);
  }

  /* --- weapon mastery --- */
  if (d.masteries.length) {
    const ms = section('Weapon Mastery');
    for (const m of d.masteries) {
      ms.appendChild(el('div', { class: 'featureblock' },
        el('h4', { text: `${m.weapon}: ${m.mastery.name}` }),
        el('p', { text: m.mastery.plain })));
    }
    left.appendChild(ms);
  }

  /* --- spellcasting --- */
  if (d.spellcasting || d.bonusSpells.length) {
    const sp = section('Spellcasting');
    if (d.spellcasting) {
      const sc = d.spellcasting;
      sp.appendChild(el('p', {},
        el('b', { text: `${sc.abilityName}  ·  ` }),
        `Save DC ${sc.saveDC}  ·  Attack ${fmt(sc.attackBonus)}  ·  `,
        el('b', { text: `${sc.slots['1']} level 1 slot${sc.slots['1'] > 1 ? 's' : ''}` }),
        ` (back on ${sc.slotRecharge || 'a Long Rest'})`));

      if (char.spells.cantrips.length) {
        sp.appendChild(el('p', {}, el('b', { text: 'Cantrips (unlimited): ' }),
          char.spells.cantrips.map(id => DATA.byId.spell[id]?.name).filter(Boolean).join(', ')));
      }
      if (char.spells.prepared.length) {
        sp.appendChild(el('p', {}, el('b', { text: 'Prepared: ' }),
          char.spells.prepared.map(id => DATA.byId.spell[id]?.name).filter(Boolean).join(', ')));
      }
      if (char.spells.spellbook.length) {
        const unprepped = char.spells.spellbook.filter(id => !char.spells.prepared.includes(id));
        if (unprepped.length) {
          sp.appendChild(el('p', { class: 'muted' }, el('b', { text: 'Also in your spellbook: ' }),
            unprepped.map(id => DATA.byId.spell[id]?.name).filter(Boolean).join(', ')));
        }
      }
    }
    for (const b of d.bonusSpells) {
      sp.appendChild(el('p', { class: 'muted', style: 'font-size:.85rem' },
        el('b', { text: b.spell.name }), ` — ${b.kind === 'cantrip' ? 'at will' : b.kind === 'always' ? 'always prepared' : 'free once per Long Rest'} (${b.source})`));
    }
    right.appendChild(sp);

    // Full text of every spell, so the sheet works away from a book.
    const chosen = [...char.spells.cantrips, ...char.spells.prepared]
      .map(id => DATA.byId.spell[id]).filter(Boolean)
      .concat(d.bonusSpells.map(b => b.spell));
    const seen = new Set();
    const uniq = chosen.filter(s => !seen.has(s.id) && seen.add(s.id))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    if (uniq.length) {
      const det = section('Your spells in full');
      for (const s of uniq) {
        det.appendChild(el('div', { class: 'featureblock' },
          el('h4', {}, s.name, ' ', pill(s.level === 0 ? 'Cantrip' : `Level ${s.level}`)),
          el('p', { style: 'font-size:.78rem', text: `${s.castingTime} · ${s.range} · ${s.components} · ${s.duration}` }),
          el('p', { text: s.description }),
          s.higherLevel ? el('p', { style: 'font-size:.8rem', text: `Higher level: ${s.higherLevel}` }) : null));
      }
      right.appendChild(det);
    }
  }

  /* --- features --- */
  const fs = section('Class & Species Features');
  for (const f of [...(d.cls.features || []), ...(d.cls.extraFeatures || [])]) {
    let extra = '';
    const chosenId = f.choice ? char.classChoices[f.choice.id] : null;
    if (chosenId && f.choice?.options) {
      const o = f.choice.options.find(x => x.id === chosenId);
      if (o) extra = ` — ${o.name}`;
    } else if (Array.isArray(chosenId) && chosenId.length) {
      extra = ` — ${chosenId.join(', ')}`;
    } else if (chosenId && DATA.byId.feat[chosenId]) {
      extra = ` — ${DATA.byId.feat[chosenId].name}`;
    }
    fs.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: f.name + extra }),
      el('p', { text: f.plain })));
  }
  for (const t of d.sp.traits) {
    fs.appendChild(el('div', { class: 'featureblock' },
      el('h4', { text: `${t.name} (${d.sp.name})` }),
      el('p', { text: t.plain })));
  }
  right.appendChild(fs);

  /* --- feats --- */
  if (d.feats.length) {
    const ft = section('Feats');
    for (const { feat, source } of d.feats) {
      ft.appendChild(el('div', { class: 'featureblock' },
        el('h4', {}, feat.name, ' ', pill(`from ${source}`)),
        el('p', { text: feat.plain })));
    }
    right.appendChild(ft);
  }

  /* --- proficiencies --- */
  const pr = section('Other Proficiencies');
  pr.appendChild(el('p', {}, el('b', { text: 'Armor: ' }), d.cls.armorTraining));
  pr.appendChild(el('p', {}, el('b', { text: 'Weapons: ' }), d.cls.weaponProficiencies));
  if (d.tools.length) pr.appendChild(el('p', {}, el('b', { text: 'Tools: ' }), d.tools.map(t => `${t.name} (${t.source})`).join(', ')));
  const langs = ['Common'];
  if (char.classChoices.language) langs.push(char.classChoices.language);
  if (d.cls.id === 'rogue') langs.push("Thieves' Cant");
  if (d.cls.id === 'druid') langs.push('Druidic');
  pr.appendChild(el('p', {}, el('b', { text: 'Languages: ' }), langs.join(', '), el('span', { class: 'muted', text: ' (plus two more of your choice, ask your DM)' })));
  if (d.resistances.length) pr.appendChild(el('p', {}, el('b', { text: 'Resistances: ' }), d.resistances.join(', '), el('span', { class: 'muted', text: ' — that damage is halved against you' })));
  left.appendChild(pr);

  /* --- equipment --- */
  const eq = section('Equipment');
  const ul = el('ul');
  for (const it of d.items) ul.appendChild(el('li', { text: it.name }));
  if (d.gp) ul.appendChild(el('li', {}, el('b', { text: `${d.gp} GP` })));
  eq.appendChild(ul);
  for (const it of d.items) {
    const pack = DATA.byId.pack[it.name];
    if (pack) eq.appendChild(el('p', { class: 'muted', style: 'font-size:.78rem', text: `${pack.name}: ${pack.contents.join(', ')}.` }));
  }
  left.appendChild(eq);

  cols.appendChild(left);
  cols.appendChild(right);
  sheet.appendChild(cols);
  root.appendChild(sheet);

  root.appendChild(notice('tip', 'What to do on your first turn',
    firstTurnAdvice(d)));

  root.appendChild(notice('', 'Levelling up later',
    `At level 2 you gain more hit points and a new ${d.cls.name} feature. At level 3 you choose your subclass, which is the next big decision. This builder covers level 1; keep your sheet and come back when you level.`));
}

function section(title) {
  return el('div', { class: 'sheet-sec' }, el('h3', { text: title }));
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
