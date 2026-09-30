/* Turns rules terms inside body text into hoverable definitions.

   The app already ships a rules glossary, so any sentence that says "Heroic
   Inspiration" or "Long Rest" can define itself in place. That lets the app
   show the real rules wording, which is what a player will hear at a table,
   without the wording being opaque to someone reading it for the first time.

   Built as DOM nodes rather than an innerHTML string so that SRD text
   containing < or & can never break the markup. */

import { DATA } from './data.js';
import { el } from './ui.js';

let TERMS = null;   // [{ match, term, text }], longest match first

function build() {
  const out = [];
  for (const g of DATA.rules.glossary) {
    // "Armor Class (AC)" should match both "Armor Class" and "AC".
    const base = g.term.replace(/\s*\(.*\)$/, '').trim();
    const paren = (g.term.match(/\(([^)]+)\)/) || [])[1];
    out.push({ match: base, term: g.term, text: g.text });
    if (paren) out.push({ match: paren, term: g.term, text: g.text });
  }
  // Longest first so "Spell Save DC" wins over "Spell Slot" style prefixes.
  out.sort((a, b) => b.match.length - a.match.length);
  return out;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split `text` into nodes, wrapping any glossary term in a definition chip.
 *  Returns a DocumentFragment. Terms are matched whole-word, case-insensitively,
 *  and each distinct term is linked only once per passage so a paragraph does
 *  not turn into a wall of underlines. */
export function glossify(text) {
  const frag = document.createDocumentFragment();
  if (!text) return frag;
  TERMS ||= build();
  if (!TERMS.length) { frag.appendChild(document.createTextNode(text)); return frag; }

  const re = new RegExp('\\b(' + TERMS.map(t => escapeRe(t.match)).join('|') + ')\\b', 'gi');
  const seen = new Set();
  let last = 0, m;

  while ((m = re.exec(text)) !== null) {
    const hit = TERMS.find(t => t.match.toLowerCase() === m[1].toLowerCase());
    if (!hit || seen.has(hit.term)) continue;
    seen.add(hit.term);
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    frag.appendChild(chip(m[1], hit));
    last = m.index + m[1].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

/* A button rather than a span: it must be reachable by keyboard and tappable
   on a phone, where there is no hover. */
function chip(label, hit) {
  const bubble = el('span', { class: 'gloss-pop', role: 'tooltip' },
    el('b', { text: hit.term }), ' ', hit.text);
  const btn = el('button', {
    type: 'button', class: 'gloss',
    'aria-label': `${label}: ${hit.text}`,
    onClick: e => {
      e.preventDefault();
      e.stopPropagation();
      const open = btn.classList.toggle('open');
      // Only one open at a time, so tapping around a paragraph is not messy.
      if (open) document.querySelectorAll('.gloss.open').forEach(o => { if (o !== btn) o.classList.remove('open'); });
    }
  }, label, bubble);
  return btn;
}

/** Convenience: a <p> whose text has been glossified. */
export function glossP(text, attrs = {}) {
  const p = el('p', attrs);
  p.appendChild(glossify(text));
  return p;
}

// Tapping elsewhere closes any open definition.
if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    if (!e.target.closest('.gloss')) {
      document.querySelectorAll('.gloss.open').forEach(o => o.classList.remove('open'));
    }
  });
}
