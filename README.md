# Level 1 Character Builder

A step-by-step D&D 2024 character builder aimed at players who have never made a character before. It walks you through seven screens and ends with a complete, printable level 1 character sheet.

Everything is explained twice: once in the actual rules text, and once in plain language.

## The seven steps

1. **Class** — what your character does. Sorted with the simplest classes flagged.
2. **Species** — what kind of person they are. (In the 2024 rules this does *not* change ability scores.)
3. **Ability scores** — standard array, point buy, rolling, or typing them in.
4. **Background** — where your +2/+1 ability bonuses, Origin feat, skills and tool come from.
5. **Proficiencies & gear** — class skills, feature choices, weapon mastery, starting equipment.
6. **Spells** — cantrips and level 1 spells, with search and filters. Skipped automatically for classes that do not cast.
7. **Character sheet** — the finished thing, with every number worked out and every spell written in full.

Progress saves to your browser automatically. There is a rules glossary behind the **Reference** button.

## Running it

It is a static site with no build step and no dependencies at runtime.

```bash
npm run serve     # http://localhost:8123
```

You cannot just double-click `index.html`: browsers block `fetch` on `file://` URLs, so the data files will not load. Any local web server works.

## Publishing to GitHub Pages

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.

The site lands at `https://<you>.github.io/<repo>/`. The `.nojekyll` file is already present so GitHub serves the folders as-is.

## Where the content comes from

All game content is from the **System Reference Document 5.2.1**, published by Wizards of the Coast under **CC-BY-4.0**. That license permits redistribution, which is why this repo can be public.

Everything the SRD covers is here:

| Included | Count |
|---|---|
| Classes (full level 1 data) | 12 |
| Species | 9 |
| Backgrounds | 4 |
| Origin / Fighting Style / General feats | 12 |
| Spells (all levels, fully parsed) | 339 |
| Weapons with mastery properties | 38 |
| Armor | 12 |

**Not in the SRD**, and therefore not in this repo: Aasimar, 12 of the 16 Player's Handbook backgrounds, and three of the four subclasses per class. Subclasses do not matter here because the 2024 rules start subclasses at level 3.

Two ways to cover the gap:

- **Custom Background** is built into step 4. It uses the official custom-background rules from the SRD Gameplay Toolbox, so players can invent whatever background they want.
- **`data/extras.json`** is loaded automatically if it exists and is gitignored, so it never reaches GitHub. Copy `data/extras.example.json` to `data/extras.json` and fill in content from your own copy of the Player's Handbook. Entries with a new id are added; entries reusing an existing id replace it.

## Project layout

```
index.html            the whole app shell
css/style.css         styles, including the print stylesheet
js/data.js            loads data/*.json, merges extras, builds lookups
js/rules.js           character state and all derived math (AC, HP, skills, DCs)
js/ui.js              small DOM helpers
js/steps.js           the seven step screens
js/sheet.js           the final sheet, plus text export
js/app.js             navigation, summary rail, theme, reference modal
data/*.json           all game content
test/rules.test.mjs   101 assertions on the character math
test/dom.test.html    168 assertions that every screen renders
sources/              the SRD parser and dev server
```

## Tests

```bash
npm test                              # character math, in Node
npm run serve                         # then open /test/dom.test.html
```

`test/rules.test.mjs` hand-checks derived numbers against the SRD: a Fighter in Chain Mail with the Defense style is AC 17, a Dwarf Barbarian using Unarmored Defense is AC 15 with 16 HP, a Wizard with INT 17 has spell save DC 13, and so on.

`test/dom.test.html` builds a complete character for all 12 classes and renders all 7 screens for each, then asserts the finished sheet appears with sane AC and HP. The page title becomes `PASSED` or `FAILED`.

## Regenerating the spell data

`data/spells.json` is parsed from the SRD PDF. The PDF and the extracted text are gitignored, so fetch them first:

```bash
curl -sL -o sources/SRD_CC_v5.2.1.pdf \
  "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf"
npm install                                          # pdfjs-dist, dev only
node sources/extract.cjs sources/SRD_CC_v5.2.1.pdf sources/srd.txt
npm run build-spells
```

The parser reads the per-class spell list tables to get canonical spell names, then parses the spell description blocks and reconciles the two.

## Attribution

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at <https://www.dndbeyond.com/srd>. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

Compatible with fifth edition. The plain-language explanations, the code and the design are original work. Not affiliated with Wizards of the Coast.
