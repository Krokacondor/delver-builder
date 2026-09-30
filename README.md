# Delver-Builder

A step-by-step level 1 character builder for fifth edition, aimed at players who have never made a character before. It walks you through seven screens and ends with a complete, printable level 1 character sheet.

Everything is explained twice: once in the actual rules text, and once in plain language.

## The seven steps

1. **Class**: what your character does. Sorted with the simplest classes flagged.
2. **Species**: what kind of person they are. (In the 2024 rules this does *not* change ability scores.)
3. **Ability scores**: standard array, point buy, rolling, or typing them in.
4. **Background**: where your +2/+1 ability bonuses, Origin feat, skills and tool come from.
5. **Proficiencies & gear**: class skills, feature choices, weapon mastery, starting equipment.
6. **Spells**: cantrips and level 1 spells, with search and filters. Skipped automatically for classes that do not cast.
7. **Character sheet**: the finished thing, with every number worked out and every spell written in full.

Progress saves to your browser automatically. There is a rules glossary behind the **Reference** button.

## Running it

It is a static site with no build step and no dependencies at runtime.

```bash
npm run serve     # http://localhost:8123
```

You cannot just double-click `index.html`: browsers block `fetch` on `file://` URLs, so the data files will not load. Any local web server works.

## Live site

<https://krokacondor.github.io/delver-builder/>

To publish a fork of your own:

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
| Backgrounds | 4, plus a custom-background builder |
| Origin / Fighting Style / General feats | 12 |
| Spells (all levels, fully parsed) | 339 |
| Weapons with mastery properties | 38 |
| Armor | 12 |

**Not in the SRD:** Aasimar, 12 of the 16 Player's Handbook backgrounds, and three of the four subclasses per class. Subclasses do not matter here, because the 2024 rules start subclasses at level 3.

This project ships **SRD content only**, so everything here is under a licence that permits redistribution. Two things cover the gap:

- **Custom Background** is built into step 4. It uses the official custom-background rules from the SRD Gameplay Toolbox: choose three ability scores, an Origin feat, two skills, a tool and a 50 GP kit. A player can build any background they want, including a close equivalent of a Player's Handbook one.
- **`data/extras.json`** is loaded automatically if you create it, and merges into the core data. It is gitignored, so anything you put there stays on your machine and is never published. Copy `data/extras.example.json` to `data/extras.json` and fill in content from a book you own. Entries with a new id are added; entries reusing an existing id replace the core one.
- **Your own additions.** Entries in `extras.json` with a new id are added; entries reusing an existing id replace the core one. `data/extras.example.json` shows the shape. To keep an addition off GitHub, put it in a separate file and add that filename to `.gitignore`.

## Next steps

Planned work, roughly in the order it is likely to happen.

1. **Fixing any visual issues.** Ongoing polish of the layout on screen and in print. The character sheet in particular has had several rounds already and still deserves a close look at odd spacing, panels that do not fill their column, and how it behaves on a phone.

2. **Working with the official character sheet.** Right now the app draws its own sheet. The goal is to also fill the official Wizards of the Coast sheet, so a player can hand in the form their group already uses instead of a lookalike.

3. **Saving characters properly.** Today a character lives in one browser's local storage, one at a time, and clearing site data loses it. Needed: more than one character per person, export and import as a file, and something that survives switching devices.

4. **Levels 2 through 20.** The app stops at level 1. Levelling up brings subclasses at level 3, Ability Score Improvements and feats, higher-level spell slots and prepared counts, and per-class features at every step.

5. **Additional book sources.** Content beyond the SRD and the Player's Handbook, added through the same `data/extras.json` merge mechanism described above.

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
test/rules.test.mjs   115 assertions on the character math
test/dom.test.html    179 assertions that every screen renders
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

## Licensing

Everything in this repository is under a licence that permits redistribution. There are two layers, and the distinction matters if you reuse the project.

**The code** is licensed under the MIT Licence. See `LICENSE`, and `NOTICE` for how that licence relates to the game data. That covers the HTML, CSS and JavaScript, the parser and build scripts, the tests, and the original plain-language explanations written for this project. Reuse it freely.

**The game content** under `data/` is from the System Reference Document 5.2.1, published by Wizards of the Coast under CC-BY-4.0. That licence permits redistribution but requires attribution, and the MIT licence above does not replace that requirement. If you reuse the data, carry the attribution statement below with it.

No content from the Player's Handbook or any other non-open source is included.

## Attribution

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at <https://www.dndbeyond.com/srd>. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

Delver-Builder is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

Compatible with fifth edition. This is a free, non-commercial project. Not affiliated with Wizards of the Coast.
