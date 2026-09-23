const fs = require('fs');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
(async () => {
  const data = new Uint8Array(fs.readFileSync(process.argv[2]));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  console.error('pages:', doc.numPages);
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let last = null, line = [], lines = [];
    for (const it of tc.items) {
      const y = Math.round(it.transform[5]);
      if (last !== null && Math.abs(y - last) > 2) { lines.push(line.join('')); line = []; }
      line.push(it.str); last = y;
    }
    lines.push(line.join(''));
    out.push(`\n===== PAGE ${p} =====\n` + lines.join('\n'));
  }
  fs.writeFileSync(process.argv[3], out.join('\n'));
  console.error('wrote', process.argv[3]);
})();
