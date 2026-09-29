/* Generates dist/artifact.html from index.html + css/style.css.

   A published artifact wraps the file in its own <!doctype>/<html>/<head>/<body>
   skeleton, so the entry file must contain only the page content, with its
   <title> and <style> at the top. The CSS is inlined; the JS modules and JSON
   data ship alongside as published files and are fetched with relative URLs.

   Usage: node sources/build-artifact.cjs */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const css = read('css/style.css');

// Pull out <title> and everything between <body> and </body>.
const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Delver-Builder'])[1];
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
if (!bodyMatch) {
  console.error('Could not find <body> in index.html');
  process.exit(1);
}

let body = bodyMatch[1].trim();

// The artifact's icon comes from the publish call, not a <link rel="icon">.
body = body.replace(/\s*<link rel="icon"[^>]*>\s*/g, '\n');

const out = `<title>${title}</title>
<style>
${css.trim()}
</style>

${body}
`;

const distDir = path.join(ROOT, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'artifact.html'), out);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`wrote dist/artifact.html  (${kb(out.length)})`);
console.log(`  title: ${title}`);

// Sanity checks against the page contract.
const problems = [];
// Note the [\s>] guards: without them "<header" matches "<head".
if (/<!DOCTYPE|<html[\s>]|<head[\s>]|<body[\s>]/i.test(out)) problems.push('entry file still contains skeleton tags');
if (/<link rel="stylesheet"/i.test(out)) problems.push('entry file still links an external stylesheet');
if (!/<script type="module" src="js\/app\.js">/.test(out)) problems.push('module script tag missing');
if (out.length > 16 * 1024 * 1024) problems.push('entry file exceeds the 16MB page limit');
if (problems.length) {
  console.error('PROBLEMS:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('  contract checks passed');
