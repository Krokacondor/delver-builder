/* Bootstrap, navigation, summary rail and reference modal. */

import { DATA, loadData } from './data.js';
import { el, clear, scrollToTop } from './ui.js';
import { newCharacter, save, load, clearSaved, derive, stepIssues, fmt, ABILS } from './rules.js';
import { STEPS, renderClass, renderSpecies, renderAbilities, renderBackground, renderProficiencies, renderSpells } from './steps.js';
import { renderSheet } from './sheet.js';

const RENDERERS = {
  class: renderClass,
  species: renderSpecies,
  abilities: renderAbilities,
  background: renderBackground,
  proficiencies: renderProficiencies,
  spells: renderSpells,
  sheet: renderSheet
};

let char = newCharacter();
let current = 'class';

const $ = sel => document.querySelector(sel);

/* ---------------- theme ---------------- */

function initTheme() {
  try {
    const saved = localStorage.getItem('dnd24-theme');
    if (saved) document.documentElement.dataset.theme = saved;
  } catch { /* ignore */ }
  $('#btn-theme').addEventListener('click', () => {
    const now = document.documentElement.dataset.theme;
    const isDark = now === 'dark' || (!now && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('dnd24-theme', next); } catch { /* ignore */ }
  });
}

/* ---------------- navigation ---------------- */

/** A step is reachable once every earlier step is satisfied. */
function furthestAllowed() {
  for (let i = 0; i < STEPS.length; i++) {
    if (stepIssues(char, STEPS[i].id).length) return i;
  }
  return STEPS.length - 1;
}

function goto(stepId) {
  const idx = STEPS.findIndex(s => s.id === stepId);
  if (idx < 0) return;
  current = stepId;
  location.hash = stepId;
  update({ scroll: true });
}

function paintStepper() {
  const list = clear($('#stepper-list'));
  const allowed = furthestAllowed();
  STEPS.forEach((s, i) => {
    const done = i < allowed || (i === allowed && !stepIssues(char, s.id).length);
    const li = el('li', {
      class: done && s.id !== current ? 'done' : '',
      'aria-current': s.id === current ? 'step' : null
    });
    li.appendChild(el('button', {
      type: 'button',
      disabled: i > allowed + 0 && i > STEPS.findIndex(x => x.id === current) ? true : false,
      onClick: () => goto(s.id)
    },
      el('span', { class: 'num', text: done && s.id !== current ? '✓' : String(s.num) }),
      s.label));
    list.appendChild(li);
  });
}

function paintNav() {
  const idx = STEPS.findIndex(s => s.id === current);
  $('#btn-prev').disabled = idx === 0;
  const next = $('#btn-next');
  const issues = stepIssues(char, current);
  const status = $('#nav-status');

  if (idx === STEPS.length - 1) {
    next.classList.add('hidden');
  } else {
    next.classList.remove('hidden');
    next.disabled = issues.length > 0;
    next.textContent = idx === STEPS.length - 2 ? 'See my character sheet →' : 'Next →';
  }

  if (issues.length) {
    status.className = 'navrow-status blocked';
    status.textContent = issues.length === 1 ? issues[0] : `Still to do: ${issues.join('; ')}`;
  } else {
    status.className = 'navrow-status';
    status.textContent = idx === STEPS.length - 1 ? 'Your character is complete.' : 'Ready for the next step.';
  }
}

function paintSummary() {
  const body = $('#summary-body');
  const title = $('#summary-title');
  clear(body);

  const bits = [];
  if (char.classId) bits.push(DATA.byId.class[char.classId].name);
  if (char.speciesId) bits.push(DATA.byId.species[char.speciesId].name);
  title.textContent = bits.length
    ? `${char.name || 'Your character'}: Level 1 ${bits.join(' ')}`
    : 'Your character (nothing chosen yet)';

  if (!char.classId) {
    body.appendChild(el('p', { class: 'muted', text: 'Pick a class to get started. Your choices are saved in this browser automatically.' }));
    return;
  }

  const d = derive(char);
  const grid = el('div', { class: 'sumgrid' });
  const item = (k, v) => grid.appendChild(el('div', { class: 'sumitem' },
    el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })));

  item('Class', d.cls.name);
  if (d.sp) item('Species', d.sp.name);
  if (d.bg) item('Background', d.bg.name);
  if (char.baseAbilities.str) {
    item('Abilities', ABILS.map(a => `${DATA.byId.ability[a].short} ${d.abilities[a]}`).join('  '));
  }
  if (d.sp && d.bg) {
    item('Armor Class', String(d.ac));
    item('Hit Points', String(d.hp));
    item('Initiative', fmt(d.initiative));
    item('Speed', `${d.speed} ft`);
  }
  if (d.spellcasting) item('Spell save DC', String(d.spellcasting.saveDC));
  body.appendChild(grid);
}

function update(opts = {}) {
  save(char);
  const root = clear($('#step-root'));
  const step = el('div', { class: 'step' });
  RENDERERS[current](step, char, ctx);
  root.appendChild(step);
  paintStepper();
  paintNav();
  paintSummary();
  if (opts.scroll) scrollToTop();
  if (opts.keepFocus) {
    /* Re-rendering blows away focus. Restore it by a stable key the renderer
       put on the control, never by its value: two abilities sitting at the
       same score would otherwise hand focus to whichever came first in the
       document, so the caret hopped between rows as you typed. */
    const match = root.querySelector(`[data-fkey="${CSS.escape(opts.keepFocus)}"]`);
    if (match) match.focus();
  }
}

const ctx = {
  update,
  goto,
  silentSave: () => { save(char); paintSummary(); },
  /* Save and repaint everything around the step without rebuilding the step
     itself, so a control the user is actively working in survives. */
  refresh: () => { save(char); paintStepper(); paintNav(); paintSummary(); }
};

/* ---------------- reference modal ---------------- */

function openReference() {
  const body = clear($('#modal-body'));
  $('#modal-title').textContent = 'Rules reference';
  const dl = el('dl');
  for (const g of DATA.rules.glossary) {
    dl.appendChild(el('dt', { text: g.term }));
    dl.appendChild(el('dd', { text: g.text }));
  }
  body.appendChild(dl);
  if (DATA.extrasLoaded) {
    body.appendChild(el('p', { class: 'muted', style: 'margin-top:16px;font-size:.8rem',
      text: `Local extras loaded: ${DATA.extrasLoaded}.` }));
  }
  $('#modal').hidden = false;
  $('#modal-close').focus();
}

function closeModal() { $('#modal').hidden = true; }

/* ---------------- start ---------------- */

async function start() {
  initTheme();

  try {
    await loadData();
  } catch (err) {
    $('#step-root').appendChild(el('div', { class: 'notice warn' },
      el('strong', { text: 'Could not load the game data' }),
      el('p', { text: String(err.message || err) }),
      el('p', { text: 'If you opened this file directly from your computer, browsers block loading the data files. Serve the folder over http instead, for example: npx serve' })));
    return;
  }

  const saved = load();
  if (saved) char = saved;

  const fromHash = location.hash.replace('#', '');
  if (STEPS.some(s => s.id === fromHash)) current = fromHash;

  $('#btn-prev').addEventListener('click', () => {
    const i = STEPS.findIndex(s => s.id === current);
    if (i > 0) goto(STEPS[i - 1].id);
  });
  $('#btn-next').addEventListener('click', () => {
    const i = STEPS.findIndex(s => s.id === current);
    if (i < STEPS.length - 1) goto(STEPS[i + 1].id);
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Start over? This erases the character you are building.')) return;
    clearSaved();
    char = newCharacter();
    goto('class');
  });
  $('#btn-reference').addEventListener('click', openReference);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  const toggle = $('#summary-toggle');
  toggle.addEventListener('click', () => {
    const open = $('#summary-body').classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (STEPS.some(s => s.id === h) && h !== current) { current = h; update({ scroll: true }); }
  });

  update();
}

start();
