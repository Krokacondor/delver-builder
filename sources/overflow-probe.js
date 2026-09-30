/* Dev aid: reports any element wider than the viewport, which is what causes
   a page to scroll sideways on a phone. Loaded only by a temporary check page,
   never by the app itself. */
window.addEventListener('load', () => setTimeout(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll('*').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width > vw + 1 || r.right > vw + 1) {
      const cls = (e.className && typeof e.className === 'string')
        ? '.' + e.className.trim().split(/\s+/).join('.')
        : '';
      bad.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + cls
        + '  w=' + Math.round(r.width) + ' right=' + Math.round(r.right));
    }
  });
  const lines = [...new Set(bad)].slice(0, 30);
  const pre = document.createElement('pre');
  pre.id = 'overflow';
  pre.style.cssText = 'position:fixed;inset:0;background:#fff;color:#000;z-index:9999;font:11px monospace;overflow:auto;padding:8px;margin:0';
  pre.textContent = 'viewport ' + vw + 'px | document scrollWidth ' + document.documentElement.scrollWidth
    + '\n\n' + (lines.length ? lines.join('\n') : 'nothing overflows');
  document.body.appendChild(pre);
}, 2500));
