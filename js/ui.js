/* Tiny DOM helpers. el() builds nodes, esc() is used anywhere raw data
   reaches innerHTML so SRD text with < or & cannot break the markup. */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const clear = node => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export function pill(text, kind) {
  return el('span', { class: `pill${kind ? ' ' + kind : ''}` }, text);
}

export function difficultyDots(n, max = 4) {
  const wrap = el('span', { class: 'diffdots', title: `Complexity ${n} of ${max}`, 'aria-label': `Complexity ${n} of ${max}` });
  for (let i = 1; i <= max; i++) wrap.appendChild(el('i', { class: i <= n ? 'on' : '' }));
  return wrap;
}

export function notice(kind, title, body) {
  return el('div', { class: `notice ${kind}` }, title ? el('strong', { text: title }) : null, body);
}

/** A counter line like "2 of 3 chosen" that turns green when satisfied. */
export function counter(have, need, label) {
  const done = have === need;
  return el('p', { class: `counter${done ? ' done' : ''}` },
    el('b', { text: `${have} of ${need}` }), ` ${label}${done ? ' ✓' : ''}`);
}

/** Selectable card. onPick receives the id. */
export function choiceCard({ id, title, tagline, plain, meta = [], selected, onPick, compact }) {
  const card = el('button', {
    type: 'button',
    class: `card${compact ? ' compact' : ''}`,
    'aria-pressed': selected ? 'true' : 'false',
    onClick: () => onPick(id)
  });
  card.appendChild(el('h4', { text: title }));
  if (tagline) card.appendChild(el('p', { class: 'tagline', text: tagline }));
  if (plain) card.appendChild(el('p', { class: 'plain', text: plain }));
  if (meta.length) {
    const m = el('div', { class: 'meta' });
    for (const x of meta) m.appendChild(typeof x === 'string' ? pill(x) : x);
    card.appendChild(m);
  }
  return card;
}

/** Checkbox row used for skills, spells, tools. */
export function checkRow({ label, sub, src, checked, disabled, onToggle }) {
  const input = el('input', { type: 'checkbox', checked: checked || false, disabled: disabled || false });
  const row = el('label', { class: `check${checked ? ' on' : ''}${disabled ? ' disabled' : ''}` },
    input,
    el('span', {},
      el('span', { class: 'lbl' }, label, src ? el('span', { class: 'src', text: ` — ${src}` }) : null),
      sub ? el('span', { class: 'sub', text: sub }) : null
    )
  );
  input.addEventListener('change', () => onToggle(input.checked));
  return row;
}

/** Collapsible description with a Show more toggle for long SRD text. */
export function expandable(text, clampAt = 220) {
  const wrap = el('div');
  if (!text) return wrap;
  const p = el('p', { class: 'spell-desc' + (text.length > clampAt ? ' clamped' : ''), text });
  wrap.appendChild(p);
  if (text.length > clampAt) {
    const btn = el('button', {
      type: 'button', class: 'spell-more', text: 'Show more',
      onClick: e => {
        e.stopPropagation(); e.preventDefault();
        const on = p.classList.toggle('clamped');
        btn.textContent = on ? 'Show more' : 'Show less';
      }
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
