# RecipeBook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine statische, read-only Rezept-Website (Astro, GitHub Pages) mit Tags, Suche, Sortierung, Portionsumrechnung, Abhaken, Dark Mode – befüllt mit den 11 migrierten Notion-Rezepten.

**Architecture:** Jedes Rezept ist ein Ordner mit `index.md` (Frontmatter + Markdown) und Bildern in `src/content/recipes/`. Astro baut daraus statisches HTML; ein remark-Plugin wandelt `{{Menge}}`-Markierungen in `<span class="qty">` um, ein rehype-Plugin gruppiert die Abschnitte für das Layout. Kleine clientseitige Skripte übernehmen Umrechnung, Abhaken, Filter und Theme. Ein GitHub-Actions-Workflow testet, baut und deployt bei jedem Push auf `main`.

**Tech Stack:** Node 24, Astro 5.18.2, TypeScript 5.9.3, Vitest 3.2.7, sharp 0.34.5, heic-convert 2.1.0, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-08-recipebook-design.md`

## Global Constraints

- Exakte Versionen (mit `--save-exact`): `astro@5.18.2`, `sharp@0.34.5` (dependencies); `vitest@3.2.7`, `typescript@5.9.3`, `heic-convert@2.1.0` (devDependencies). Keine weiteren Laufzeit-Abhängigkeiten.
- `site: 'https://esstobst.github.io'`, `base: '/RecipeBook'`. Jeder interne Link und jedes Asset aus `public/` geht über `url()` aus `src/lib/url.ts`.
- Oberfläche komplett auf Deutsch, `<html lang="de">`.
- Kein Login, kein Server, kein Service Worker, kein Offline-Modus.
- Jeder Zugriff auf `localStorage` steht in `try/catch`; ohne Storage funktioniert jede Seite.
- Rezeptinhalte folgen der Stilrichtlinie in `CLAUDE.md` (= Spec-Abschnitt „Stilrichtlinie für Rezepte“).
- Commit-Messages enden mit `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Push auf `main` = Live-Deploy; vor jedem Push `npm test` und `npm run build` lokal grün.
- Shell-Befehle in diesem Plan sind Git-Bash-Syntax (Windows), Arbeitsverzeichnis `C:\Projekts\RecipeBook`.

## Review Focus

1. `{{1.000 g}}` (deutscher Tausenderpunkt) → muss als 1000 g gelesen werden, nicht als 1 g. Test in Task 2.
2. Kaputte Markierungen (`{{500 g` ohne Schluss, `{{}}`, `{{20g}}`, `{{800 ml – 1 l}}`) → Build bricht mit Rezeptpfad ab; nie geschweifte Klammern auf der Website. Tests in Task 2 und Task 3.
3. Lesezeichen mit veraltetem Tag oder ungültiger Sortierung (`?tags=Main%20dish&sort=xyz`) → unbekannte Werte werden ignoriert, Seite zeigt Standardansicht statt leerer Liste. Test in Task 7.
4. Suche ohne Umlaute („hahnchen“, „haehnchen“) → findet „Hähnchen“. Test in Task 7.
5. Kaputter oder fehlender `localStorage`-Inhalt für Häkchen (`"{"`, `"[1,2]"`, privater Modus) → startet ohne Häkchen, kein Absturz. Test in Task 6.

---

## Dateistruktur

```
.github/workflows/deploy.yml        CI: test, build, deploy auf Pages
astro.config.mjs                    site/base, Markdown-Plugins
package.json, tsconfig.json, .gitignore
CLAUDE.md                           Einleseprozess + Stilrichtlinie
public/
  icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png
  manifest.webmanifest
scripts/
  prepare-image.mjs (+ .test.mjs)   Fotos → JPG max. 2000 px (inkl. HEIC)
  make-icons.mjs                    icon.svg → PNG-Icons
src/
  content.config.ts                 Rezept-Collection + Schema
  content/recipes/<slug>/index.md   Rezepte (+ cover.jpg, schritt-N.jpg)
  lib/
    scale.ts (+ test)               parse/scale/format von Mengen
    markers.ts (+ test)             {{…}} im Text finden → Segmente/HTML
    remark-quantities.ts (+ test)   remark-Plugin: {{…}} → <span class="qty">
    rehype-sections.ts (+ test)     rehype-Plugin: h2-Abschnitte → aside/main
    tags.ts (+ test)                Tag-Liste, Duplikat-Prüfung
    recipe-text.ts (+ test)         Zutatentext für die Suche
    filter.ts (+ test)              Filtern/Sortieren/URL-Zustand
    checklist.ts (+ test)           Häkchen-Zustand (de)serialisieren
    recipes.ts                      getRecipes() mit Tag-Prüfung
    url.ts                          base-bewusste URLs
  layouts/Base.astro                HTML-Gerüst, Header, Theme, Meta-Tags
  components/RecipeCard.astro, Stars.astro, Placeholder.astro
  pages/index.astro                 Übersicht
  pages/rezepte/[slug].astro        Rezeptseite
  scripts/theme.ts, overview.ts, recipe-page.ts
  styles/global.css, recipe.css, overview.css
```

---

### Task 1: Projekt-Grundgerüst und Deployment

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, `.github/workflows/deploy.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run build` → `dist/`, `npm test` → `vitest run --passWithNoTests`, `npm run image` (ab Task 9).

- [ ] **Step 1: package.json anlegen**

```json
{
  "name": "recipebook",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run --passWithNoTests",
    "image": "node scripts/prepare-image.mjs"
  }
}
```

- [ ] **Step 2: Abhängigkeiten installieren**

Run:
```bash
npm install --save-exact astro@5.18.2 sharp@0.34.5
npm install --save-exact -D vitest@3.2.7 typescript@5.9.3 heic-convert@2.1.0
```
Expected: `package-lock.json` entsteht, keine Fehler.

- [ ] **Step 3: Konfiguration**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://esstobst.github.io',
  base: '/RecipeBook',
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`.gitignore` (komplett ersetzen):
```
import/
node_modules/
dist/
.astro/
```

`src/pages/index.astro` (vorläufig, wird in Task 4 und 7 ersetzt):
```astro
---
---
<!doctype html>
<html lang="de">
  <head><meta charset="utf-8" /><title>RecipeBook</title></head>
  <body><h1>RecipeBook</h1></body>
</html>
```

- [ ] **Step 4: Deploy-Workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Lokal prüfen**

Run: `npm test && npm run build && ls dist/index.html`
Expected: Vitest meldet „No test files found, exiting with code 0“; Build erfolgreich; `dist/index.html` existiert.

- [ ] **Step 6: Commit und Push**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore src/pages/index.astro .github/workflows/deploy.yml
git commit -m "Scaffold Astro project with GitHub Pages deploy

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 7: Deploy prüfen**

Run: `curl -s "https://api.github.com/repos/EsstObst/RecipeBook/actions/runs?per_page=1" | grep -E '"(status|conclusion)"'`
Expected (nach 1–3 Min., erneut ausführen bis `completed`): `"conclusion": "success"`. Dann `curl -s https://esstobst.github.io/RecipeBook/ | grep RecipeBook` liefert die Überschrift.
Falls `deploy` mit „Pages not enabled“/404 scheitert: Nutzer bitten, Settings → Pages → Source „GitHub Actions“ zu setzen, dann Workflow über einen leeren Commit erneut auslösen (`git commit --allow-empty -m "Trigger deploy" && git push`). Falls die API 404 liefert, ist das Repo noch privat → Nutzer bitten, es öffentlich zu stellen.

---

### Task 2: Mengen-Parser und -Formatierung (`scale.ts`)

**Files:**
- Create: `src/lib/scale.ts`
- Test: `src/lib/scale.test.ts`

**Interfaces:**
- Produces:
  - `interface Quantity { min: number; max: number | null; unit: string }`
  - `parseQuantity(raw: string): Quantity | null`
  - `scaleQuantity(q: Quantity, factor: number): Quantity`
  - `formatQuantity(q: Quantity): string`

- [ ] **Step 1: Failing Tests schreiben**

`src/lib/scale.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatQuantity, parseQuantity, scaleQuantity } from './scale';

describe('parseQuantity', () => {
  it.each([
    ['500 g', { min: 500, max: null, unit: 'g' }],
    ['1,5 l', { min: 1.5, max: null, unit: 'l' }],
    ['1.5 l', { min: 1.5, max: null, unit: 'l' }],
    ['1/2 TL', { min: 0.5, max: null, unit: 'TL' }],
    ['4 1/8 Tassen', { min: 4.125, max: null, unit: 'Tassen' }],
    ['2–3 EL', { min: 2, max: 3, unit: 'EL' }],
    ['2-3 EL', { min: 2, max: 3, unit: 'EL' }],
    ['800–1000 ml', { min: 800, max: 1000, unit: 'ml' }],
    ['2', { min: 2, max: null, unit: '' }],
    ['4 Stück', { min: 4, max: null, unit: 'Stück' }],
    ['2 Bund', { min: 2, max: null, unit: 'Bund' }],
    ['1.000 g', { min: 1000, max: null, unit: 'g' }],
  ])('parses %s', (raw, expected) => {
    expect(parseQuantity(raw)).toEqual(expected);
  });

  it.each(['', 'eine Handvoll', '20g', '800 ml – 1 l', '1/0 TL', '3–2 EL', 'ca. 200 g'])(
    'rejects %j',
    (raw) => {
      expect(parseQuantity(raw)).toBeNull();
    },
  );
});

describe('scaleQuantity', () => {
  it('multiplies min and max', () => {
    expect(scaleQuantity({ min: 2, max: 3, unit: 'EL' }, 0.5)).toEqual({ min: 1, max: 1.5, unit: 'EL' });
    expect(scaleQuantity({ min: 500, max: null, unit: 'g' }, 2)).toEqual({ min: 1000, max: null, unit: 'g' });
  });
});

describe('formatQuantity', () => {
  const f = (min: number, unit: string, max: number | null = null) => formatQuantity({ min, max, unit });

  it('rounds g/ml to whole numbers below 10, else to steps of 5', () => {
    expect(f(7.4, 'g')).toBe('7 g');
    expect(f(333.3, 'g')).toBe('335 g');
    expect(f(112.4, 'ml')).toBe('110 ml');
  });

  it('rounds kg/l to one decimal with German comma', () => {
    expect(f(1.25, 'kg')).toBe('1,3 kg');
    expect(f(2, 'l')).toBe('2 l');
  });

  it('rounds spoon-like units to quarters as fractions', () => {
    expect(f(1.4, 'Tassen')).toBe('1 ½ Tassen');
    expect(f(0.75, 'TL')).toBe('¾ TL');
    expect(f(2.0625, 'Tassen')).toBe('2 Tassen');
    expect(f(1.3, 'EL')).toBe('1 ¼ EL');
  });

  it('rounds pieces and unitless to halves', () => {
    expect(f(2.4, 'Stück')).toBe('2 ½ Stück');
    expect(f(3, '')).toBe('3');
    expect(f(1.2, '')).toBe('1');
  });

  it('never shows zero', () => {
    expect(f(0.2, 'g')).toBe('1 g');
    expect(f(0.01, 'kg')).toBe('0,1 kg');
    expect(f(0.05, 'TL')).toBe('¼ TL');
    expect(f(0.1, '')).toBe('¼');
  });

  it('formats ranges and collapses equal bounds', () => {
    expect(f(0.5, 'EL', 0.75)).toBe('½–¾ EL');
    expect(f(101, 'g', 102)).toBe('100 g');
  });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `npx vitest run src/lib/scale.test.ts`
Expected: FAIL („Failed to resolve import ./scale“).

- [ ] **Step 3: Implementierung**

`src/lib/scale.ts`:
```ts
export interface Quantity {
  min: number;
  max: number | null;
  unit: string;
}

const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)`;
const QUANTITY_RE = new RegExp(String.raw`^(${NUMBER})(?:\s*[–-]\s*(${NUMBER}))?(?:\s+([^\d]+))?$`);

function parseNumber(text: string): number {
  const t = text.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  if (/^\d{1,3}\.\d{3}$/.test(t)) return Number(t.replace('.', ''));
  return Number(t.replace(',', '.'));
}

export function parseQuantity(raw: string): Quantity | null {
  const match = raw.trim().match(QUANTITY_RE);
  if (!match) return null;
  const min = parseNumber(match[1]);
  const max = match[2] === undefined ? null : parseNumber(match[2]);
  if (!Number.isFinite(min) || min <= 0) return null;
  if (max !== null && (!Number.isFinite(max) || max < min)) return null;
  return { min, max, unit: (match[3] ?? '').trim() };
}

export function scaleQuantity(q: Quantity, factor: number): Quantity {
  return { min: q.min * factor, max: q.max === null ? null : q.max * factor, unit: q.unit };
}

type Group = 'small' | 'large' | 'spoon' | 'piece';

const SMALL = new Set(['g', 'ml']);
const LARGE = new Set(['kg', 'l']);
const SPOON = new Set(['tasse', 'tassen', 'el', 'tl', 'prise', 'prisen', 'msp', 'bund', 'dose', 'dosen', 'packung', 'packungen']);

function groupOf(unit: string): Group {
  const word = unit.trim().split(/\s+/)[0].toLowerCase();
  if (SMALL.has(word)) return 'small';
  if (LARGE.has(word)) return 'large';
  if (SPOON.has(word)) return 'spoon';
  return 'piece';
}

function roundValue(v: number, group: Group): number {
  switch (group) {
    case 'small': {
      const r = v < 10 ? Math.round(v) : Math.round(v / 5) * 5;
      return r === 0 ? 1 : r;
    }
    case 'large': {
      const r = Math.round(v * 10) / 10;
      return r === 0 ? 0.1 : r;
    }
    case 'spoon': {
      const r = Math.round(v * 4) / 4;
      return r === 0 ? 0.25 : r;
    }
    case 'piece': {
      const r = Math.round(v * 2) / 2;
      return r === 0 ? 0.25 : r;
    }
  }
}

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

function formatNumber(v: number, group: Group): string {
  if (group === 'small') return String(v);
  if (group === 'large') return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  const whole = Math.floor(v);
  const fraction = FRACTIONS[v - whole];
  if (!fraction) return String(whole);
  return whole === 0 ? fraction : `${whole} ${fraction}`;
}

export function formatQuantity(q: Quantity): string {
  const group = groupOf(q.unit);
  const min = roundValue(q.min, group);
  const max = q.max === null ? null : roundValue(q.max, group);
  let text = formatNumber(min, group);
  if (max !== null && max !== min) text += `–${formatNumber(max, group)}`;
  return q.unit ? `${text} ${q.unit}` : text;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/scale.test.ts`
Expected: PASS (alle Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scale.ts src/lib/scale.test.ts
git commit -m "Add quantity parsing, scaling and formatting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Markdown-Plugins für Mengen und Abschnitte

**Files:**
- Create: `src/lib/markers.ts`, `src/lib/remark-quantities.ts`, `src/lib/rehype-sections.ts`
- Test: `src/lib/markers.test.ts`, `src/lib/remark-quantities.test.ts`, `src/lib/rehype-sections.test.ts`
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: `parseQuantity`, `Quantity` aus `src/lib/scale.ts`.
- Produces:
  - `type Segment = { type: 'text'; value: string } | { type: 'qty'; raw: string; quantity: Quantity }`
  - `splitQuantities(text: string): Segment[]` (wirft bei kaputter Markierung)
  - `quantityHtml(raw: string, q: Quantity): string` → `<span class="qty" data-min="…" data-max="…" data-unit="…">raw</span>`
  - `transformQuantities(tree)`, `remarkQuantities()`
  - `sectionKey(title: string): string`, `groupSections(root)`, `rehypeSections()`
  - HTML-Struktur der Rezept-Body (Task 5/6 verlassen sich darauf): `div.recipe-aside > section.recipe-section.recipe-section--zutaten|--equipment`, `div.recipe-main > section.recipe-section--zubereitung|--tipps`; Mengen als `span.qty[data-min][data-max][data-unit]`.

- [ ] **Step 1: Failing Tests für `markers.ts`**

`src/lib/markers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { quantityHtml, splitQuantities } from './markers';

describe('splitQuantities', () => {
  it('returns plain text unchanged', () => {
    expect(splitQuantities('Salz, Pfeffer')).toEqual([{ type: 'text', value: 'Salz, Pfeffer' }]);
  });

  it('splits markers out of text', () => {
    expect(splitQuantities('Orzo anrösten. {{4 1/8 Tassen}} Brühe und {{2}} Zitronen')).toEqual([
      { type: 'text', value: 'Orzo anrösten. ' },
      { type: 'qty', raw: '4 1/8 Tassen', quantity: { min: 4.125, max: null, unit: 'Tassen' } },
      { type: 'text', value: ' Brühe und ' },
      { type: 'qty', raw: '2', quantity: { min: 2, max: null, unit: '' } },
      { type: 'text', value: ' Zitronen' },
    ]);
  });

  it('throws on unclosed marker', () => {
    expect(() => splitQuantities('{{500 g Orzo')).toThrow(/Nicht geschlossene Mengenmarkierung/);
  });

  it.each(['{{}} Orzo', '{{eine Handvoll}} Rucola', '{{20g}} Ingwer', '{{800 ml – 1 l}} Tomaten'])(
    'throws on unreadable marker %j',
    (text) => {
      expect(() => splitQuantities(text)).toThrow(/Unlesbare Mengenmarkierung/);
    },
  );
});

describe('quantityHtml', () => {
  it('renders a span with data attributes and escapes text', () => {
    expect(quantityHtml('2–3 EL', { min: 2, max: 3, unit: 'EL' })).toBe(
      '<span class="qty" data-min="2" data-max="3" data-unit="EL">2–3 EL</span>',
    );
    expect(quantityHtml('1 <x>', { min: 1, max: null, unit: '<x>' })).toBe(
      '<span class="qty" data-min="1" data-max="" data-unit="&lt;x&gt;">1 &lt;x&gt;</span>',
    );
  });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `npx vitest run src/lib/markers.test.ts`
Expected: FAIL („Failed to resolve import ./markers“).

- [ ] **Step 3: `markers.ts` implementieren**

`src/lib/markers.ts`:
```ts
import { parseQuantity, type Quantity } from './scale';

export type Segment = { type: 'text'; value: string } | { type: 'qty'; raw: string; quantity: Quantity };

export function splitQuantities(text: string): Segment[] {
  const segments: Segment[] = [];
  let rest = text;
  while (rest.length > 0) {
    const open = rest.indexOf('{{');
    if (open === -1) {
      segments.push({ type: 'text', value: rest });
      break;
    }
    const close = rest.indexOf('}}', open + 2);
    if (close === -1) throw new Error(`Nicht geschlossene Mengenmarkierung: "${rest.slice(open)}"`);
    if (open > 0) segments.push({ type: 'text', value: rest.slice(0, open) });
    const raw = rest.slice(open + 2, close).trim();
    const quantity = parseQuantity(raw);
    if (!quantity) throw new Error(`Unlesbare Mengenmarkierung: "{{${raw}}}"`);
    segments.push({ type: 'qty', raw, quantity });
    rest = rest.slice(close + 2);
  }
  return segments;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function quantityHtml(raw: string, q: Quantity): string {
  return `<span class="qty" data-min="${q.min}" data-max="${q.max ?? ''}" data-unit="${escapeHtml(q.unit)}">${escapeHtml(raw)}</span>`;
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/lib/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Failing Tests für die Plugins**

`src/lib/remark-quantities.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { remarkQuantities, transformQuantities } from './remark-quantities';

const listWith = (value: string) => ({
  type: 'root',
  children: [
    {
      type: 'list',
      children: [{ type: 'listItem', children: [{ type: 'paragraph', children: [{ type: 'text', value }] }] }],
    },
  ],
});

describe('transformQuantities', () => {
  it('replaces markers in nested text nodes with html nodes', () => {
    const tree = listWith('{{500 g}} Orzo');
    transformQuantities(tree);
    expect(tree.children[0].children[0].children[0].children).toEqual([
      { type: 'html', value: '<span class="qty" data-min="500" data-max="" data-unit="g">500 g</span>' },
      { type: 'text', value: ' Orzo' },
    ]);
  });

  it('leaves text without markers untouched', () => {
    const tree = listWith('Salz, Pfeffer');
    transformQuantities(tree);
    expect(tree.children[0].children[0].children[0].children).toEqual([{ type: 'text', value: 'Salz, Pfeffer' }]);
  });
});

describe('remarkQuantities', () => {
  it('prefixes errors with the file path', () => {
    const run = remarkQuantities();
    expect(() => run(listWith('{{eine Handvoll}} Rucola'), { path: 'src/content/recipes/x/index.md' })).toThrow(
      'src/content/recipes/x/index.md: Unlesbare Mengenmarkierung: "{{eine Handvoll}}"',
    );
  });
});
```

`src/lib/rehype-sections.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { groupSections, sectionKey } from './rehype-sections';

const h2 = (text: string) => ({ type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: text }] });
const el = (tagName: string) => ({ type: 'element', tagName, properties: {}, children: [] });

describe('sectionKey', () => {
  it('slugifies German headings', () => {
    expect(sectionKey('Zutaten')).toBe('zutaten');
    expect(sectionKey('Tipps & Varianten')).toBe('tipps-varianten');
    expect(sectionKey('Größe')).toBe('groesse');
  });
});

describe('groupSections', () => {
  it('wraps sections and splits them into aside and main', () => {
    const zutaten = h2('Zutaten');
    const ul = el('ul');
    const equipment = h2('Equipment');
    const ul2 = el('ul');
    const zubereitung = h2('Zubereitung');
    const ol = el('ol');
    const tipps = h2('Tipps');
    const ul3 = el('ul');
    const root = { type: 'root', children: [zutaten, ul, equipment, ul2, zubereitung, ol, tipps, ul3] };

    groupSections(root);

    const section = (key: string, children: unknown[]) => ({
      type: 'element',
      tagName: 'section',
      properties: { className: ['recipe-section', `recipe-section--${key}`] },
      children,
    });
    expect(root.children).toEqual([
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['recipe-aside'] },
        children: [section('zutaten', [zutaten, ul]), section('equipment', [equipment, ul2])],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['recipe-main'] },
        children: [section('zubereitung', [zubereitung, ol]), section('tipps', [tipps, ul3])],
      },
    ]);
  });

  it('leaves documents without h2 unchanged', () => {
    const p = el('p');
    const root = { type: 'root', children: [p] };
    groupSections(root);
    expect(root.children).toEqual([p]);
  });
});
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/lib/remark-quantities.test.ts src/lib/rehype-sections.test.ts`
Expected: FAIL (Module fehlen).

- [ ] **Step 7: Plugins implementieren**

`src/lib/remark-quantities.ts`:
```ts
import { quantityHtml, splitQuantities } from './markers';

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

export function transformQuantities(node: MdNode): void {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && child.value?.includes('{{')) {
      for (const segment of splitQuantities(child.value)) {
        next.push(
          segment.type === 'text'
            ? { type: 'text', value: segment.value }
            : { type: 'html', value: quantityHtml(segment.raw, segment.quantity) },
        );
      }
    } else {
      transformQuantities(child);
      next.push(child);
    }
  }
  node.children = next;
}

export function remarkQuantities() {
  return (tree: MdNode, file: { path?: string }) => {
    try {
      transformQuantities(tree);
    } catch (error) {
      throw new Error(`${file.path ?? 'Rezept'}: ${(error as Error).message}`);
    }
  };
}
```

`src/lib/rehype-sections.ts`:
```ts
interface HNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
  value?: string;
}

const ASIDE_KEYS = new Set(['zutaten', 'equipment']);

export function sectionKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function textOf(node: HNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

const wrapper = (className: string, children: HNode[]): HNode => ({
  type: 'element',
  tagName: 'div',
  properties: { className: [className] },
  children,
});

export function groupSections(root: HNode): void {
  const before: HNode[] = [];
  const aside: HNode[] = [];
  const main: HNode[] = [];
  let current: HNode | null = null;

  for (const child of root.children ?? []) {
    if (child.type === 'element' && child.tagName === 'h2') {
      const key = sectionKey(textOf(child));
      current = {
        type: 'element',
        tagName: 'section',
        properties: { className: ['recipe-section', `recipe-section--${key}`] },
        children: [child],
      };
      (ASIDE_KEYS.has(key) ? aside : main).push(current);
    } else if (current) {
      current.children!.push(child);
    } else {
      before.push(child);
    }
  }

  if (aside.length === 0 && main.length === 0) return;
  root.children = [
    ...before,
    ...(aside.length > 0 ? [wrapper('recipe-aside', aside)] : []),
    ...(main.length > 0 ? [wrapper('recipe-main', main)] : []),
  ];
}

export function rehypeSections() {
  return (tree: HNode) => groupSections(tree);
}
```

- [ ] **Step 8: Tests laufen lassen**

Run: `npm test`
Expected: PASS (scale, markers, remark-quantities, rehype-sections).

- [ ] **Step 9: Plugins in Astro einhängen**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import { remarkQuantities } from './src/lib/remark-quantities.ts';
import { rehypeSections } from './src/lib/rehype-sections.ts';

export default defineConfig({
  site: 'https://esstobst.github.io',
  base: '/RecipeBook',
  markdown: {
    remarkPlugins: [remarkQuantities],
    rehypePlugins: [rehypeSections],
  },
});
```

Run: `npm run build`
Expected: Build erfolgreich (noch keine Rezepte, Plugins werden nur geladen).

- [ ] **Step 10: Commit**

```bash
git add src/lib/markers.ts src/lib/markers.test.ts src/lib/remark-quantities.ts src/lib/remark-quantities.test.ts src/lib/rehype-sections.ts src/lib/rehype-sections.test.ts astro.config.mjs
git commit -m "Add markdown plugins for quantity markers and recipe sections

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Grundlayout, Styles und Dark Mode

**Files:**
- Create: `src/lib/url.ts`, `src/layouts/Base.astro`, `src/scripts/theme.ts`, `src/styles/global.css`, `src/components/Stars.astro`, `src/components/Placeholder.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Produces:
  - `url(path: string): string` (z. B. `url('')` → `/RecipeBook/`), `recipeUrl(id: string): string` → `/RecipeBook/rezepte/<id>/`, `tagUrl(tag: string): string` → `/RecipeBook/?tags=<encoded>`
  - `<Base title description? image?>` mit `<slot />`
  - `<Stars rating={number} />`, `<Placeholder />`
  - CSS-Tokens: `--bg --surface --surface-2 --text --muted --border --accent --accent-soft --star --font-body --font-head --radius`; Klassen `.tag`, `.tag-list`, `.stars`, `.placeholder`, `.page`

- [ ] **Step 1: URL-Helfer**

`src/lib/url.ts`:
```ts
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  return `${base}/${path.replace(/^\//, '')}`;
}

export function recipeUrl(id: string): string {
  return url(`rezepte/${id}/`);
}

export function tagUrl(tag: string): string {
  return url(`?tags=${encodeURIComponent(tag)}`);
}
```

- [ ] **Step 2: Globale Styles**

`src/styles/global.css`:
```css
:root {
  --bg: #faf8f5;
  --surface: #ffffff;
  --surface-2: #f1ede7;
  --text: #2a2622;
  --muted: #6f675e;
  --border: #e3ddd4;
  --accent: #b5562b;
  --accent-soft: #f6e3d8;
  --star: #d9971a;
  --font-body: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-head: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --radius: 12px;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #191817;
    --surface: #232220;
    --surface-2: #2d2b28;
    --text: #ece8e2;
    --muted: #a39b91;
    --border: #37342f;
    --accent: #e58a5c;
    --accent-soft: #3a2a21;
    --star: #f2bd3c;
    color-scheme: dark;
  }
}

:root[data-theme='dark'] {
  --bg: #191817;
  --surface: #232220;
  --surface-2: #2d2b28;
  --text: #ece8e2;
  --muted: #a39b91;
  --border: #37342f;
  --accent: #e58a5c;
  --accent-soft: #3a2a21;
  --star: #f2bd3c;
  color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 1.0625rem;
  line-height: 1.55;
}
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }
h1, h2, h3 { font-family: var(--font-head); line-height: 1.2; }
button { font: inherit; color: inherit; }
[hidden] { display: none !important; }

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.site-title { font-family: var(--font-head); font-size: 1.25rem; font-weight: 700; text-decoration: none; }
.theme-toggle {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
}
.page { max-width: 1200px; margin: 0 auto; padding: 1rem; }

.tag {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 0.85rem;
  text-decoration: none;
}
.tag-list { display: flex; flex-wrap: wrap; gap: 0.4rem; list-style: none; padding: 0; margin: 0; }
.stars { color: var(--star); letter-spacing: 0.05em; }
.stars-empty { color: var(--border); }
.placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  min-height: 8rem;
  background: linear-gradient(135deg, var(--surface-2), var(--surface));
  color: var(--muted);
}
```

- [ ] **Step 3: Komponenten**

`src/components/Stars.astro`:
```astro
---
interface Props {
  rating: number;
}
const { rating } = Astro.props;
---
<span class="stars" aria-label={`${rating} von 5 Sternen`}>{'★'.repeat(rating)}<span class="stars-empty">{'★'.repeat(5 - rating)}</span></span>
```

`src/components/Placeholder.astro`:
```astro
<div class="placeholder" aria-hidden="true">
  <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <circle cx="34" cy="34" r="16" />
    <circle cx="34" cy="34" r="10" />
    <path d="M10 12v14M7 12v8a3 3 0 0 0 6 0v-8M10 26v26M56 12c-4 3-4 12 0 16v24" />
  </svg>
</div>
```

- [ ] **Step 4: Theme-Skript und Layout**

`src/scripts/theme.ts`:
```ts
const root = document.documentElement;

function effectiveTheme(): 'light' | 'dark' {
  const chosen = root.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // Speicher nicht verfügbar – Auswahl gilt nur für diese Seite.
  }
});
```

`src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import { url } from '../lib/url';

interface Props {
  title: string;
  description?: string;
  image?: string;
}
const { title, description = 'Meine Rezeptsammlung', image } = Astro.props;
const pageTitle = title === 'RecipeBook' ? title : `${title} · RecipeBook`;
---
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <script is:inline>
      try {
        const t = localStorage.getItem('theme');
        if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
      } catch {}
    </script>
  </head>
  <body>
    <header class="site-header">
      <a class="site-title" href={url('')}>RecipeBook</a>
      <button class="theme-toggle" type="button" aria-label="Hell/Dunkel umschalten">◐</button>
    </header>
    <main class="page">
      <slot />
    </main>
    <script>
      import '../scripts/theme';
    </script>
  </body>
</html>
```
(`image` wird in Task 8 für Open Graph genutzt.)

`src/pages/index.astro` (vorläufig):
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="RecipeBook">
  <p>Rezepte folgen.</p>
</Base>
```

- [ ] **Step 5: Prüfen**

Run: `npm run build && grep -c 'theme-toggle' dist/index.html && grep -c 'href="/RecipeBook/"' dist/index.html`
Expected: Build erfolgreich, beide `grep` liefern `1`.
Dann `npm run dev`, `http://localhost:4321/RecipeBook/` öffnen: Umschalter wechselt hell/dunkel, nach Neuladen bleibt die Wahl erhalten.

- [ ] **Step 6: Commit**

```bash
git add src/lib/url.ts src/layouts/Base.astro src/scripts/theme.ts src/styles/global.css src/components/Stars.astro src/components/Placeholder.astro src/pages/index.astro
git commit -m "Add base layout, theme tokens and dark mode toggle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rezept-Collection und Rezeptseite

**Files:**
- Create: `src/content.config.ts`, `src/lib/tags.ts`, `src/lib/tags.test.ts`, `src/lib/recipes.ts`, `src/pages/rezepte/[slug].astro`, `src/styles/recipe.css`, `src/content/recipes/mediterrane-haehnchen-orzo/index.md`

**Interfaces:**
- Consumes: `url`, `tagUrl` (Task 4), `Base`, `Stars`, `Placeholder` (Task 4), HTML-Struktur aus Task 3.
- Produces:
  - Collection `recipes`, Entry-`id` = Ordnername; `data`: `{ title, servings, servingsLabel, tags, added: Date, cover?, duration?, rating?, source? }`; `body: string`
  - `type Recipe = CollectionEntry<'recipes'>`, `getRecipes(): Promise<Recipe[]>` (nach Titel sortiert, wirft bei Tag-Konflikt)
  - `findTagConflicts(tagLists: string[][]): string[]`, `allTags(tagLists: string[][]): string[]`
  - DOM der Rezeptseite für Task 6: `article.recipe[data-recipe-id][data-servings]`, `.servings-count`, `.servings-btn[data-step="-1"|"1"]`, `.servings-reset`, `label.wake-lock` mit `input.wake-lock-input`, `.checks-reset`, `.recipe-body`, `dialog.lightbox > img`

- [ ] **Step 1: Failing Tests für `tags.ts`**

`src/lib/tags.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { allTags, findTagConflicts } from './tags';

describe('findTagConflicts', () => {
  it('finds tags that differ only in case', () => {
    expect(findTagConflicts([['Vegetarisch', 'Hauptspeise'], ['vegetarisch'], ['Hauptspeise']])).toEqual([
      'Vegetarisch / vegetarisch',
    ]);
  });

  it('returns nothing for consistent tags', () => {
    expect(findTagConflicts([['Rind'], ['Rind', 'Suppe']])).toEqual([]);
  });
});

describe('allTags', () => {
  it('returns unique tags sorted in German order', () => {
    expect(allTags([['Suppe', 'Ärger'], ['Auflauf', 'Suppe']])).toEqual(['Ärger', 'Auflauf', 'Suppe']);
  });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `npx vitest run src/lib/tags.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `tags.ts` implementieren**

`src/lib/tags.ts`:
```ts
export function findTagConflicts(tagLists: string[][]): string[] {
  const byKey = new Map<string, Set<string>>();
  for (const tag of tagLists.flat()) {
    const key = tag.toLocaleLowerCase('de');
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key)!.add(tag);
  }
  return [...byKey.values()].filter((variants) => variants.size > 1).map((variants) => [...variants].sort().join(' / '));
}

export function allTags(tagLists: string[][]): string[] {
  return [...new Set(tagLists.flat())].sort((a, b) => a.localeCompare(b, 'de'));
}
```

Run: `npx vitest run src/lib/tags.test.ts` → PASS.

- [ ] **Step 4: Collection-Schema und Zugriff**

`src/content.config.ts`:
```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const tag = z
  .string()
  .trim()
  .min(1)
  .refine((t) => !t.includes(','), 'Tags dürfen kein Komma enthalten');

const recipes = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/recipes',
    generateId: ({ entry }) => entry.split(/[\\/]/)[0],
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        servings: z.number().int().min(1),
        servingsLabel: z.string().min(1).default('Personen'),
        tags: z.array(tag),
        added: z.coerce.date(),
        cover: image().optional(),
        duration: z.number().int().positive().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        source: z
          .string()
          .min(1)
          .refine((s) => !s.startsWith('http') || URL.canParse(s), 'Quelle ist keine gültige URL')
          .optional(),
      })
      .strict(),
});

export const collections = { recipes };
```

`src/lib/recipes.ts`:
```ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { findTagConflicts } from './tags';

export type Recipe = CollectionEntry<'recipes'>;

export async function getRecipes(): Promise<Recipe[]> {
  const recipes = await getCollection('recipes');
  const conflicts = findTagConflicts(recipes.map((r) => r.data.tags));
  if (conflicts.length > 0) {
    throw new Error(`Tags unterscheiden sich nur in der Schreibweise: ${conflicts.join('; ')}`);
  }
  return recipes.sort((a, b) => a.data.title.localeCompare(b.data.title, 'de'));
}
```

- [ ] **Step 5: Beispielrezept (wird in Task 10 um Cover ergänzt)**

`src/content/recipes/mediterrane-haehnchen-orzo/index.md`:
```markdown
---
title: Mediterrane Hähnchen-Orzo
tags: [Hähnchen, Hauptspeise, OnePot]
duration: 60
rating: 4
servings: 4
source: TikTok
added: 2026-10-08
---

## Zutaten

- {{4 Stück}} Pollo-Fino (Hähnchenschenkel, entbeint)
- {{2}} Zwiebeln, gewürfelt
- {{4}} Knoblauchzehen, fein gehackt
- {{2}} Zucchini, gewürfelt
- {{500 g}} Orzo (Kritharaki)
- {{4 1/8 Tassen}} Gemüsebrühe
- {{500 g}} Kirschtomaten
- {{300 g}} Babyspinat
- {{1 1/4 Tassen}} Schlagsahne
- {{2}} Bio-Zitronen (Abrieb und etwas Saft)
- {{160 g}} Parmesan, frisch gerieben
- {{2 Bund}} Petersilie, gehackt
- Bratolivenöl (z. B. Bertolli)
- Paprikapulver, Chiliflocken, Salz, Pfeffer

## Zubereitung

1. **Hähnchen anbraten:** Hähnchen mit Paprikapulver, Salz und Pfeffer würzen. In Bratolivenöl auf der Hautseite bei starker Hitze 3–4 Min. goldbraun anbraten, wenden und bei kleinerer Hitze gar ziehen lassen. Aus der Pfanne nehmen.
2. **Gemüse andünsten:** In derselben Pfanne Zwiebeln, Knoblauch und Zucchini andünsten. Mit Salz, Pfeffer, Paprikapulver und Chiliflocken würzen.
3. **Orzo garen:** Orzo zugeben und kurz anrösten. {{4 1/8 Tassen}} Gemüsebrühe nach und nach unter ständigem Rühren zugießen, bis die Nudeln gar sind.
4. **Soße fertigstellen:** Kirschtomaten, Babyspinat, Sahne, Zitronenabrieb und einen Schuss Zitronensaft unterrühren. Köcheln lassen, bis der Spinat zusammenfällt.
5. **Servieren:** Hähnchen in Scheiben schneiden, zurück in die Pfanne geben und kurz erwärmen. Mit Parmesan und Petersilie bestreuen.
```

- [ ] **Step 6: Rezeptseite und Styles**

`src/styles/recipe.css`:
```css
.recipe-hero {
  margin: -1rem -1rem 0;
  aspect-ratio: 16 / 7;
  max-height: 50vh;
  overflow: hidden;
  background: var(--surface-2);
}
.recipe-hero img, .recipe-hero .placeholder { width: 100%; height: 100%; object-fit: cover; }
.recipe-header h1 { font-size: clamp(1.75rem, 5vw, 2.75rem); margin: 1.25rem 0 0.5rem; }
.recipe-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  color: var(--muted);
}
.recipe-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin: 1rem -1rem;
  padding: 0.6rem 1rem;
  background: var(--bg);
  border-block: 1px solid var(--border);
}
.servings { display: flex; align-items: center; gap: 0.5rem; }
.servings-btn {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  font-size: 1.25rem;
  cursor: pointer;
}
.servings-btn:disabled { opacity: 0.4; cursor: default; }
.servings-value { min-width: 7rem; text-align: center; font-weight: 600; }
.servings-reset, .checks-reset {
  padding: 0.25rem;
  border: none;
  background: none;
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
.wake-lock { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.qty--scaled {
  padding: 0 0.2em;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.recipe-body h2 { font-size: 1.5rem; margin: 1.5rem 0 0.75rem; }
.recipe-body h3 { font-size: 1.1rem; margin: 1rem 0 0.5rem; color: var(--muted); }
.recipe-body ul, .recipe-body ol { padding-left: 1.4rem; }
.recipe-body li { margin: 0.35rem 0; }
.recipe-section--zubereitung ol > li { margin: 0.9rem 0; }
.recipe-body li img {
  display: inline-block;
  max-width: min(100%, 22rem);
  margin: 0.6rem 0.5rem 0 0;
  border-radius: var(--radius);
  vertical-align: top;
  cursor: zoom-in;
}
.checkable { cursor: pointer; }
.is-checked { color: var(--muted); text-decoration: line-through; opacity: 0.7; }
.recipe-section--tipps { color: var(--muted); }

@media (min-width: 900px) {
  .recipe-body {
    display: grid;
    grid-template-columns: minmax(16rem, 1fr) 2fr;
    gap: 2.5rem;
    align-items: start;
  }
  .recipe-aside {
    position: sticky;
    top: 4.5rem;
    max-height: calc(100vh - 5.5rem);
    overflow-y: auto;
    padding: 0 1rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
}

.lightbox { padding: 0; border: none; background: transparent; max-width: 95vw; max-height: 95vh; }
.lightbox::backdrop { background: rgb(0 0 0 / 0.85); }
.lightbox img { max-width: 95vw; max-height: 95vh; object-fit: contain; }
```

`src/pages/rezepte/[slug].astro`:
```astro
---
import { Image } from 'astro:assets';
import { render } from 'astro:content';
import Base from '../../layouts/Base.astro';
import Placeholder from '../../components/Placeholder.astro';
import Stars from '../../components/Stars.astro';
import { getRecipes, type Recipe } from '../../lib/recipes';
import { tagUrl } from '../../lib/url';
import '../../styles/recipe.css';

export async function getStaticPaths() {
  const recipes = await getRecipes();
  return recipes.map((recipe) => ({ params: { slug: recipe.id }, props: { recipe } }));
}

const { recipe } = Astro.props as { recipe: Recipe };
const { Content } = await render(recipe);
const d = recipe.data;
const sourceIsLink = d.source?.startsWith('http') ?? false;
---
<Base title={d.title}>
  <article class="recipe" data-recipe-id={recipe.id} data-servings={d.servings}>
    <div class="recipe-hero">
      {d.cover ? <Image src={d.cover} alt={d.title} widths={[480, 960, 1600]} sizes="100vw" loading="eager" /> : <Placeholder />}
    </div>
    <header class="recipe-header">
      <h1>{d.title}</h1>
      <ul class="recipe-meta">
        {d.duration && <li>⏱ {d.duration} Min.</li>}
        {d.rating && <li><Stars rating={d.rating} /></li>}
        {d.source && (
          <li>
            Quelle:{' '}
            {sourceIsLink ? <a href={d.source} target="_blank" rel="noopener">{new URL(d.source).hostname}</a> : d.source}
          </li>
        )}
      </ul>
      <ul class="tag-list">
        {d.tags.map((t) => <li><a class="tag" href={tagUrl(t)}>{t}</a></li>)}
      </ul>
    </header>
    <div class="recipe-toolbar">
      <div class="servings" role="group" aria-label="Portionen">
        <button type="button" class="servings-btn" data-step="-1" aria-label="Weniger">−</button>
        <span class="servings-value"><output class="servings-count">{d.servings}</output> {d.servingsLabel}</span>
        <button type="button" class="servings-btn" data-step="1" aria-label="Mehr">+</button>
        <button type="button" class="servings-reset" hidden>Zurücksetzen</button>
      </div>
      <label class="wake-lock" hidden><input type="checkbox" class="wake-lock-input" /> Bildschirm an</label>
      <button type="button" class="checks-reset" hidden>Häkchen zurücksetzen</button>
    </div>
    <div class="recipe-body">
      <Content />
    </div>
  </article>
  <dialog class="lightbox"><img alt="" /></dialog>
</Base>
```

- [ ] **Step 7: Build prüfen**

Run:
```bash
npm test && npm run build
F=dist/rezepte/mediterrane-haehnchen-orzo/index.html
grep -c 'class="qty"' $F; grep -c 'recipe-aside' $F; grep -c 'recipe-section--zubereitung' $F; grep -c '{{' $F
```
Expected: Build erfolgreich; erste drei `grep` > 0 (`class="qty"` mindestens 13), letzter `grep` = `0`.

- [ ] **Step 8: Fehlerfälle prüfen (Schema, Markierung, Tag-Konflikt)**

Run:
```bash
mkdir -p src/content/recipes/zz-test
printf -- '---\ntitle: Test\ntags: []\nadded: 2026-10-08\n---\n\n## Zutaten\n- Salz\n' > src/content/recipes/zz-test/index.md
npm run build 2>&1 | grep -i servings
printf -- '---\ntitle: Test\nservings: 2\ntags: []\nadded: 2026-10-08\n---\n\n## Zutaten\n- {{eine Handvoll}} Rucola\n' > src/content/recipes/zz-test/index.md
npm run build 2>&1 | grep 'Unlesbare Mengenmarkierung'
printf -- '---\ntitle: Test\nservings: 2\ntags: [hähnchen]\nadded: 2026-10-08\n---\n\n## Zutaten\n- Salz\n' > src/content/recipes/zz-test/index.md
npm run build 2>&1 | grep 'nur in der Schreibweise'
rm -rf src/content/recipes/zz-test
```
Expected: Jeder Build schlägt fehl, jedes `grep` findet die Meldung (fehlendes `servings`; Pfad `zz-test/index.md` + „Unlesbare Mengenmarkierung“; „Hähnchen / hähnchen“). Danach ist der Testordner gelöscht.

- [ ] **Step 9: Sichtprüfung**

Run: `npm run dev`, `http://localhost:4321/RecipeBook/rezepte/mediterrane-haehnchen-orzo/` öffnen.
Expected: Platzhalter-Banner, Titel, Dauer, 4 Sterne, Quelle, Tags; Desktop: Zutaten links in Kasten, Zubereitung rechts; schmales Fenster (< 900 px): untereinander; Dark Mode passt.

- [ ] **Step 10: Commit und Push**

```bash
git add src/content.config.ts src/lib/tags.ts src/lib/tags.test.ts src/lib/recipes.ts "src/pages/rezepte/[slug].astro" src/styles/recipe.css src/content/recipes/mediterrane-haehnchen-orzo/index.md
git commit -m "Add recipe collection, schema validation and recipe page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: Rezeptseite interaktiv (Portionen, Abhaken, Bildschirm an, Großansicht)

**Files:**
- Create: `src/lib/checklist.ts`, `src/lib/checklist.test.ts`, `src/scripts/recipe-page.ts`
- Modify: `src/pages/rezepte/[slug].astro` (Script-Tag am Ende)

**Interfaces:**
- Consumes: `formatQuantity`, `scaleQuantity`, `Quantity` (Task 2); DOM aus Task 5; `span.qty[data-min][data-max][data-unit]` (Task 3).
- Produces: `parseChecked(raw: string | null): Set<string>`, `serializeChecked(set: Set<string>): string`; `localStorage`-Key `checked:<recipe-id>`.

- [ ] **Step 1: Failing Tests**

`src/lib/checklist.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseChecked, serializeChecked } from './checklist';

describe('parseChecked', () => {
  it('returns an empty set for missing or broken data', () => {
    expect(parseChecked(null)).toEqual(new Set());
    expect(parseChecked('{')).toEqual(new Set());
    expect(parseChecked('"x"')).toEqual(new Set());
  });

  it('keeps only string entries', () => {
    expect(parseChecked('[1,"3",null,"0"]')).toEqual(new Set(['3', '0']));
  });

  it('round-trips with serializeChecked', () => {
    const set = new Set(['2', '0']);
    expect(serializeChecked(set)).toBe('["0","2"]');
    expect(parseChecked(serializeChecked(set))).toEqual(set);
  });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `npx vitest run src/lib/checklist.test.ts`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Implementierung**

`src/lib/checklist.ts`:
```ts
export function parseChecked(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

export function serializeChecked(set: Set<string>): string {
  return JSON.stringify([...set].sort());
}
```

Run: `npx vitest run src/lib/checklist.test.ts` → PASS.

- [ ] **Step 4: Client-Skript**

`src/scripts/recipe-page.ts`:
```ts
import { parseChecked, serializeChecked } from '../lib/checklist';
import { formatQuantity, scaleQuantity, type Quantity } from '../lib/scale';

const CHECKABLE = '.recipe-section--zutaten li, .recipe-section--zubereitung ol > li';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Speicher nicht verfügbar – Zustand gilt nur bis zum Neuladen.
  }
}

function initServings(article: HTMLElement): void {
  const original = Number(article.dataset.servings);
  const count = article.querySelector<HTMLElement>('.servings-count')!;
  const reset = article.querySelector<HTMLButtonElement>('.servings-reset')!;
  const buttons = [...article.querySelectorAll<HTMLButtonElement>('.servings-btn')];
  const quantities = [...article.querySelectorAll<HTMLElement>('.recipe-body .qty')].map((el) => ({
    el,
    original: el.textContent ?? '',
    quantity: {
      min: Number(el.dataset.min),
      max: el.dataset.max ? Number(el.dataset.max) : null,
      unit: el.dataset.unit ?? '',
    } satisfies Quantity,
  }));
  let current = original;

  function apply(): void {
    count.textContent = String(current);
    for (const button of buttons) {
      const step = Number(button.dataset.step);
      button.disabled = (step < 0 && current <= 1) || (step > 0 && current >= 99);
    }
    reset.hidden = current === original;
    const scaled = current !== original;
    for (const q of quantities) {
      q.el.textContent = scaled ? formatQuantity(scaleQuantity(q.quantity, current / original)) : q.original;
      q.el.classList.toggle('qty--scaled', scaled);
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      current = Math.min(99, Math.max(1, current + Number(button.dataset.step)));
      apply();
    });
  }
  reset.addEventListener('click', () => {
    current = original;
    apply();
  });
  apply();
}

function initChecklist(article: HTMLElement): void {
  const key = `checked:${article.dataset.recipeId}`;
  const items = [...article.querySelectorAll<HTMLElement>(CHECKABLE)];
  const reset = article.querySelector<HTMLButtonElement>('.checks-reset')!;
  let checked = parseChecked(readStorage(key));

  items.forEach((item, index) => {
    item.dataset.checkId = String(index);
    item.classList.add('checkable');
  });

  function render(): void {
    for (const item of items) item.classList.toggle('is-checked', checked.has(item.dataset.checkId!));
    reset.hidden = checked.size === 0;
    writeStorage(key, checked.size === 0 ? null : serializeChecked(checked));
  }

  article.querySelector('.recipe-body')!.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, img, button')) return;
    const item = target.closest<HTMLElement>('.checkable');
    if (!item) return;
    const id = item.dataset.checkId!;
    if (checked.has(id)) checked.delete(id);
    else checked.add(id);
    render();
  });
  reset.addEventListener('click', () => {
    checked = new Set();
    render();
  });
  render();
}

function initWakeLock(article: HTMLElement): void {
  const label = article.querySelector<HTMLElement>('.wake-lock')!;
  const input = label.querySelector<HTMLInputElement>('.wake-lock-input')!;
  if (!('wakeLock' in navigator)) return;
  label.hidden = false;
  let sentinel: WakeLockSentinel | null = null;

  async function request(): Promise<void> {
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      input.checked = false;
    }
  }

  input.addEventListener('change', async () => {
    if (input.checked) {
      await request();
    } else {
      await sentinel?.release();
      sentinel = null;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && input.checked && !sentinel) void request();
  });
}

function initLightbox(article: HTMLElement): void {
  const dialog = document.querySelector<HTMLDialogElement>('.lightbox');
  const big = dialog?.querySelector('img');
  if (!dialog || !big) return;
  for (const img of article.querySelectorAll<HTMLImageElement>('.recipe-body img')) {
    img.addEventListener('click', () => {
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      dialog.showModal();
    });
  }
  dialog.addEventListener('click', () => dialog.close());
}

const article = document.querySelector<HTMLElement>('article.recipe');
if (article) {
  initServings(article);
  initChecklist(article);
  initWakeLock(article);
  initLightbox(article);
}
```

In `src/pages/rezepte/[slug].astro` direkt nach `</Base>` anfügen:
```astro
<script>
  import '../../scripts/recipe-page';
</script>
```

- [ ] **Step 5: Prüfen**

Run: `npm test && npm run build`
Expected: PASS, Build erfolgreich.
Sichtprüfung mit `npm run dev` auf der Orzo-Seite:
- `+` auf 8: „500 g Orzo“ → „1000 g“, „4 1/8 Tassen“ → „8 ¼ Tassen“ (auch in Schritt 3), hervorgehoben; „3–4 Min.“ unverändert; „Zurücksetzen“ erscheint und stellt den Originaltext wieder her.
- `−` bis 1: Minus wird deaktiviert; „{{2 Bund}}“ → „½ Bund“.
- Zutat antippen → durchgestrichen; Neuladen → bleibt; „Häkchen zurücksetzen“ leert alles.
- In Chrome/Edge (unterstützt Wake Lock) erscheint „Bildschirm an“; in Firefox Desktop nicht.

- [ ] **Step 6: Commit**

```bash
git add src/lib/checklist.ts src/lib/checklist.test.ts src/scripts/recipe-page.ts "src/pages/rezepte/[slug].astro"
git commit -m "Add servings scaling, checklist, wake lock and lightbox

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Übersicht mit Suche, Tag-Filter und Sortierung

**Files:**
- Create: `src/lib/recipe-text.ts`, `src/lib/recipe-text.test.ts`, `src/lib/filter.ts`, `src/lib/filter.test.ts`, `src/components/RecipeCard.astro`, `src/scripts/overview.ts`, `src/styles/overview.css`
- Modify: `src/pages/index.astro` (komplett ersetzen)

**Interfaces:**
- Consumes: `getRecipes`, `Recipe` (Task 5), `allTags` (Task 5), `recipeUrl` (Task 4), `Stars`, `Placeholder`, `Base` (Task 4).
- Produces:
  - `ingredientText(body: string): string`
  - `type SortKey = 'name' | 'rating' | 'duration' | 'added'`, `SORT_KEYS`
  - `interface FilterState { tags: string[]; q: string; sort: SortKey }`
  - `interface RecipeSummary { id: string; title: string; tags: string[]; rating: number | null; duration: number | null; added: string; ingredients: string }`
  - `normalize(text: string): string`, `filterAndSort(items: RecipeSummary[], state: FilterState): string[]`, `parseState(search: string, knownTags: string[]): FilterState`, `toSearch(state: FilterState): string`

- [ ] **Step 1: Failing Tests**

`src/lib/recipe-text.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ingredientText } from './recipe-text';

const body = [
  '## Zutaten',
  '',
  '### Mochis',
  '- {{450 g}} Kartoffeln, mehligkochend',
  '- **Gouda**',
  '',
  '### Glasur',
  '- {{8 EL}} Sojasoße',
  '',
  '## Zubereitung',
  '1. **Kochen:** Kartoffeln kochen.',
].join('\r\n');

describe('ingredientText', () => {
  it('collects ingredient lines without markers and formatting', () => {
    expect(ingredientText(body)).toBe('Kartoffeln, mehligkochend · Gouda · Sojasoße');
  });

  it('returns empty text without an ingredient section', () => {
    expect(ingredientText('## Zubereitung\n1. Kochen')).toBe('');
  });
});
```

`src/lib/filter.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { filterAndSort, normalize, parseState, toSearch, type RecipeSummary } from './filter';

const r = (id: string, title: string, extra: Partial<RecipeSummary> = {}): RecipeSummary => ({
  id,
  title,
  tags: [],
  rating: null,
  duration: null,
  added: '2026-10-08',
  ingredients: '',
  ...extra,
});

const items = [
  r('orzo', 'Mediterrane Hähnchen-Orzo', { tags: ['Hähnchen', 'Hauptspeise'], rating: 4, duration: 60, ingredients: 'Orzo · Babyspinat' }),
  r('gnocchi', 'Gnocchi in Spinat-Frischkäse-Soße', { tags: ['Hauptspeise', 'Vegetarisch'], duration: 20, added: '2026-10-09', ingredients: 'Gnocchi · Babyspinat' }),
  r('steak', 'Steak braten', { tags: ['Hauptspeise', 'Rind'], rating: 5, duration: 15 }),
  r('mochis', 'Potato Mochis', { tags: ['Snack'] }),
];
const state = (over: Partial<{ tags: string[]; q: string; sort: 'name' | 'rating' | 'duration' | 'added' }> = {}) => ({
  tags: [],
  q: '',
  sort: 'name' as const,
  ...over,
});

describe('normalize', () => {
  it('makes umlauts and their transliterations equal', () => {
    expect(normalize('Hähnchen')).toBe(normalize('haehnchen'));
    expect(normalize('Hähnchen')).toBe(normalize('hahnchen'));
    expect(normalize('Soße')).toBe(normalize('sosse'));
  });
});

describe('filterAndSort', () => {
  it('sorts by name by default', () => {
    expect(filterAndSort(items, state())).toEqual(['gnocchi', 'orzo', 'mochis', 'steak']);
  });

  it('requires all selected tags', () => {
    expect(filterAndSort(items, state({ tags: ['Hauptspeise', 'Vegetarisch'] }))).toEqual(['gnocchi']);
  });

  it('searches title and ingredients, every word, umlaut-insensitive', () => {
    expect(filterAndSort(items, state({ q: 'haehnchen' }))).toEqual(['orzo']);
    expect(filterAndSort(items, state({ q: 'babyspinat gnocchi' }))).toEqual(['gnocchi']);
    expect(filterAndSort(items, state({ q: 'pizza' }))).toEqual([]);
  });

  it('sorts by rating desc with missing values last and name as tie-breaker', () => {
    expect(filterAndSort(items, state({ sort: 'rating' }))).toEqual(['steak', 'orzo', 'gnocchi', 'mochis']);
  });

  it('sorts by duration asc with missing values last', () => {
    expect(filterAndSort(items, state({ sort: 'duration' }))).toEqual(['steak', 'gnocchi', 'orzo', 'mochis']);
  });

  it('sorts by added desc with name as tie-breaker', () => {
    expect(filterAndSort(items, state({ sort: 'added' }))).toEqual(['gnocchi', 'orzo', 'mochis', 'steak']);
  });
});

describe('URL state', () => {
  const known = ['Hähnchen', 'Hauptspeise', 'Rind'];

  it('round-trips state through the query string', () => {
    const s = { tags: ['Hähnchen', 'Rind'], q: 'orzo', sort: 'rating' as const };
    expect(parseState(toSearch(s), known)).toEqual(s);
  });

  it('omits defaults', () => {
    expect(toSearch(state())).toBe('');
  });

  it('ignores unknown tags and invalid sort values', () => {
    expect(parseState('?tags=Main%20dish,Rind&sort=xyz', known)).toEqual({ tags: ['Rind'], q: '', sort: 'name' });
  });
});
```

- [ ] **Step 2: Tests laufen lassen**

Run: `npx vitest run src/lib/recipe-text.test.ts src/lib/filter.test.ts`
Expected: FAIL (Module fehlen).

- [ ] **Step 3: Implementierung**

`src/lib/recipe-text.ts`:
```ts
export function ingredientText(body: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Zutaten\s*$/.test(line));
  if (start === -1) return '';
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const match = line.match(/^\s*[-*]\s+(.*)$/);
    if (match) items.push(match[1].replace(/\{\{[^}]*\}\}/g, '').replace(/[*_]/g, '').trim());
  }
  return items.join(' · ');
}
```

`src/lib/filter.ts`:
```ts
export type SortKey = 'name' | 'rating' | 'duration' | 'added';
export const SORT_KEYS: SortKey[] = ['name', 'rating', 'duration', 'added'];

export interface FilterState {
  tags: string[];
  q: string;
  sort: SortKey;
}

export interface RecipeSummary {
  id: string;
  title: string;
  tags: string[];
  rating: number | null;
  duration: number | null;
  added: string;
  ingredients: string;
}

export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type Compare = (a: RecipeSummary, b: RecipeSummary) => number;

function missingLast(get: (r: RecipeSummary) => number | null, direction: 1 | -1): Compare {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * direction;
  };
}

const COMPARE: Record<SortKey, Compare> = {
  name: () => 0,
  rating: missingLast((r) => r.rating, -1),
  duration: missingLast((r) => r.duration, 1),
  added: (a, b) => b.added.localeCompare(a.added),
};

export function filterAndSort(items: RecipeSummary[], state: FilterState): string[] {
  const words = normalize(state.q).split(/\s+/).filter(Boolean);
  const byName: Compare = (a, b) => a.title.localeCompare(b.title, 'de');
  const compare = COMPARE[state.sort];
  return items
    .filter((r) => state.tags.every((t) => r.tags.includes(t)))
    .filter((r) => {
      const haystack = normalize(`${r.title} ${r.ingredients}`);
      return words.every((w) => haystack.includes(w));
    })
    .sort((a, b) => compare(a, b) || byName(a, b))
    .map((r) => r.id);
}

export function parseState(search: string, knownTags: string[]): FilterState {
  const params = new URLSearchParams(search);
  const tags = (params.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => knownTags.includes(t));
  const sort = params.get('sort');
  return {
    tags: [...new Set(tags)],
    q: params.get('q') ?? '',
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'name',
  };
}

export function toSearch(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.tags.length > 0) params.set('tags', state.tags.join(','));
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.sort !== 'name') params.set('sort', state.sort);
  const query = params.toString();
  return query ? `?${query}` : '';
}
```

Run: `npx vitest run src/lib/recipe-text.test.ts src/lib/filter.test.ts` → PASS.

- [ ] **Step 4: Karte, Styles, Seite, Skript**

`src/components/RecipeCard.astro`:
```astro
---
import { Image } from 'astro:assets';
import Placeholder from './Placeholder.astro';
import Stars from './Stars.astro';
import type { Recipe } from '../lib/recipes';
import { recipeUrl } from '../lib/url';

interface Props {
  recipe: Recipe;
}
const { recipe } = Astro.props;
const d = recipe.data;
---
<li class="card" data-id={recipe.id}>
  <a href={recipeUrl(recipe.id)}>
    <div class="card-image">
      {d.cover ? <Image src={d.cover} alt="" widths={[400, 800]} sizes="(max-width: 600px) 100vw, 400px" /> : <Placeholder />}
    </div>
    <div class="card-body">
      <h2 class="card-title">{d.title}</h2>
      <div class="card-meta">
        {d.rating && <Stars rating={d.rating} />}
        {d.duration && <span>⏱ {d.duration} Min.</span>}
      </div>
    </div>
  </a>
</li>
```

`src/styles/overview.css`:
```css
.controls { display: grid; gap: 0.75rem; margin-bottom: 1rem; }
.controls-row { display: flex; gap: 0.5rem; }
.search, .sort {
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.search { flex: 1; min-width: 0; }
.tag-filter { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.tag-chip { cursor: pointer; }
.tag-chip[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.result-count { margin: 0 0 0.75rem; color: var(--muted); font-size: 0.9rem; }
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.card a {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  text-decoration: none;
  transition: transform 0.15s ease;
}
.card a:hover { transform: translateY(-2px); }
.card-image { aspect-ratio: 16 / 10; background: var(--surface-2); }
.card-image img, .card-image .placeholder { width: 100%; height: 100%; min-height: 0; object-fit: cover; }
.card-body { display: grid; gap: 0.35rem; padding: 0.75rem 0.9rem 0.9rem; }
.card-title { margin: 0; font-size: 1.1rem; }
.card-meta { display: flex; gap: 0.75rem; color: var(--muted); font-size: 0.9rem; }
.empty { padding: 2rem 0; color: var(--muted); text-align: center; }
```

`src/pages/index.astro` (komplett ersetzen):
```astro
---
import Base from '../layouts/Base.astro';
import RecipeCard from '../components/RecipeCard.astro';
import type { RecipeSummary } from '../lib/filter';
import { ingredientText } from '../lib/recipe-text';
import { getRecipes } from '../lib/recipes';
import { allTags } from '../lib/tags';
import '../styles/overview.css';

const recipes = await getRecipes();
const tags = allTags(recipes.map((r) => r.data.tags));
const summaries: RecipeSummary[] = recipes.map((r) => ({
  id: r.id,
  title: r.data.title,
  tags: r.data.tags,
  rating: r.data.rating ?? null,
  duration: r.data.duration ?? null,
  added: r.data.added.toISOString().slice(0, 10),
  ingredients: ingredientText(r.body ?? ''),
}));
const data = JSON.stringify({ recipes: summaries, tags }).replace(/</g, '\\u003c');
---
<Base title="RecipeBook">
  <section class="controls">
    <div class="controls-row">
      <input type="search" class="search" placeholder="Rezept oder Zutat suchen …" aria-label="Suche" />
      <select class="sort" aria-label="Sortierung">
        <option value="name">Name (A–Z)</option>
        <option value="rating">Bewertung</option>
        <option value="duration">Dauer</option>
        <option value="added">Zuletzt hinzugefügt</option>
      </select>
    </div>
    <div class="tag-filter">
      {tags.map((t) => <button type="button" class="tag tag-chip" data-tag={t} aria-pressed="false">{t}</button>)}
    </div>
  </section>
  <p class="result-count" aria-live="polite">{recipes.length} Rezepte</p>
  <ul class="card-grid">
    {recipes.map((r) => <RecipeCard recipe={r} />)}
  </ul>
  <p class="empty" hidden>Keine Rezepte gefunden.</p>
  <script type="application/json" id="recipe-data" set:html={data} />
</Base>
<script>
  import '../scripts/overview';
</script>
```

`src/scripts/overview.ts`:
```ts
import { filterAndSort, parseState, toSearch, type FilterState, type RecipeSummary, type SortKey } from '../lib/filter';

interface Data {
  recipes: RecipeSummary[];
  tags: string[];
}

function init({ recipes, tags }: Data): void {
  const grid = document.querySelector<HTMLElement>('.card-grid')!;
  const cards = new Map([...grid.querySelectorAll<HTMLElement>('.card')].map((card) => [card.dataset.id!, card]));
  const search = document.querySelector<HTMLInputElement>('.search')!;
  const sort = document.querySelector<HTMLSelectElement>('.sort')!;
  const chips = [...document.querySelectorAll<HTMLButtonElement>('.tag-chip')];
  const empty = document.querySelector<HTMLElement>('.empty')!;
  const count = document.querySelector<HTMLElement>('.result-count')!;
  let state: FilterState = parseState(location.search, tags);

  function render(): void {
    const ids = filterAndSort(recipes, state);
    const visible = new Set(ids);
    for (const [id, card] of cards) card.hidden = !visible.has(id);
    for (const id of ids) grid.appendChild(cards.get(id)!);
    for (const chip of chips) chip.setAttribute('aria-pressed', String(state.tags.includes(chip.dataset.tag!)));
    if (search.value !== state.q) search.value = state.q;
    sort.value = state.sort;
    empty.hidden = ids.length > 0;
    count.textContent = ids.length === recipes.length ? `${ids.length} Rezepte` : `${ids.length} von ${recipes.length} Rezepten`;
    history.replaceState(null, '', toSearch(state) || location.pathname);
  }

  search.addEventListener('input', () => {
    state = { ...state, q: search.value };
    render();
  });
  sort.addEventListener('change', () => {
    state = { ...state, sort: sort.value as SortKey };
    render();
  });
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag!;
      const tagsNow = state.tags.includes(tag) ? state.tags.filter((t) => t !== tag) : [...state.tags, tag];
      state = { ...state, tags: tagsNow };
      render();
    });
  }
  window.addEventListener('popstate', () => {
    state = parseState(location.search, tags);
    render();
  });
  render();
}

const dataElement = document.getElementById('recipe-data');
if (dataElement?.textContent) init(JSON.parse(dataElement.textContent) as Data);
```

- [ ] **Step 5: Prüfen**

Run: `npm test && npm run build && grep -c 'class="card"' dist/index.html && grep -c 'id="recipe-data"' dist/index.html`
Expected: PASS, Build ok, beide `grep` ≥ 1.
Sichtprüfung `npm run dev` → `http://localhost:4321/RecipeBook/`:
- Tag „Hähnchen“ anklicken → URL `?tags=H%C3%A4hnchen`, Karte bleibt; zweiter Tag „Rind“ → „Keine Rezepte gefunden.“
- Suche „spinat“ findet Orzo; Sortierung wechseln ändert URL.
- Auf der Rezeptseite einen Tag anklicken → Übersicht mit gesetztem Filter.
- `http://localhost:4321/RecipeBook/?tags=Main%20dish&sort=xyz` → normale Ansicht.

- [ ] **Step 6: Commit und Push**

```bash
git add src/lib/recipe-text.ts src/lib/recipe-text.test.ts src/lib/filter.ts src/lib/filter.test.ts src/components/RecipeCard.astro src/scripts/overview.ts src/styles/overview.css src/pages/index.astro
git commit -m "Add overview with search, tag filter and sorting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 8: Homescreen-App und Link-Vorschau

**Files:**
- Create: `public/icon.svg`, `scripts/make-icons.mjs`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (generiert), `public/manifest.webmanifest`
- Modify: `src/layouts/Base.astro` (Head), `src/pages/rezepte/[slug].astro` (OG-Bild + Beschreibung), `src/pages/index.astro` (OG-Bild)

**Interfaces:**
- Consumes: `url()` (Task 4), `Base`-Prop `image?: string` (absolute URL).

- [ ] **Step 1: Icon und Generator**

`public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#b5562b"/>
  <g fill="none" stroke="#faf8f5" stroke-width="22" stroke-linecap="round">
    <circle cx="272" cy="272" r="120"/>
    <circle cx="272" cy="272" r="72"/>
    <path d="M100 104v108M76 104v64a24 24 0 0 0 48 0v-64M100 212v196"/>
  </g>
</svg>
```

`scripts/make-icons.mjs`:
```js
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('public/icon.svg');
const targets = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
];
for (const [file, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}px)`);
}
```

Run: `node scripts/make-icons.mjs`
Expected: drei PNG-Dateien in `public/`.

- [ ] **Step 2: Manifest**

`public/manifest.webmanifest`:
```json
{
  "name": "RecipeBook",
  "short_name": "Rezepte",
  "lang": "de",
  "start_url": "/RecipeBook/",
  "scope": "/RecipeBook/",
  "display": "standalone",
  "background_color": "#191817",
  "theme_color": "#191817",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Head-Tags in `Base.astro`**

Im Frontmatter von `src/layouts/Base.astro` nach `const pageTitle …` ergänzen:
```ts
const pageUrl = new URL(Astro.url.pathname, Astro.site).href;
```
Im `<head>` nach `<meta name="description" …>` einfügen:
```astro
<meta name="theme-color" content="#191817" />
<link rel="manifest" href={url('manifest.webmanifest')} />
<link rel="icon" href={url('icon.svg')} type="image/svg+xml" />
<link rel="apple-touch-icon" href={url('apple-touch-icon.png')} />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Rezepte" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="RecipeBook" />
<meta property="og:locale" content="de_DE" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={pageUrl} />
{image && <meta property="og:image" content={image} />}
<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
```

- [ ] **Step 4: OG-Bild und Beschreibung pro Seite**

In `src/pages/rezepte/[slug].astro`: Import ergänzen `import { getImage, Image } from 'astro:assets';` (statt nur `Image`) und im Frontmatter nach `const sourceIsLink …`:
```ts
const ogImage = d.cover ? await getImage({ src: d.cover, width: 1200, format: 'jpeg' }) : null;
const ogImageUrl = ogImage ? new URL(ogImage.src, Astro.site).href : new URL(url('icon-512.png'), Astro.site).href;
const description = [d.duration ? `${d.duration} Min.` : null, ...d.tags].filter(Boolean).join(' · ');
```
Import `url` ergänzen: `import { tagUrl, url } from '../../lib/url';`. Base-Aufruf ändern zu:
```astro
<Base title={d.title} description={description} image={ogImageUrl}>
```

In `src/pages/index.astro`: Import `import { url } from '../lib/url';` ergänzen, Base-Aufruf ändern zu:
```astro
<Base title="RecipeBook" image={new URL(url('icon-512.png'), Astro.site).href}>
```

- [ ] **Step 5: Prüfen**

Run:
```bash
npm test && npm run build
grep -o 'rel="manifest" href="[^"]*"' dist/index.html
grep -o 'property="og:image" content="[^"]*"' dist/rezepte/mediterrane-haehnchen-orzo/index.html
ls dist/manifest.webmanifest dist/icon-512.png
```
Expected: `href="/RecipeBook/manifest.webmanifest"`; `og:image` beginnt mit `https://esstobst.github.io/RecipeBook/`; Dateien existieren.

- [ ] **Step 6: Commit**

```bash
git add public scripts/make-icons.mjs src/layouts/Base.astro "src/pages/rezepte/[slug].astro" src/pages/index.astro
git commit -m "Add web app manifest, icons and Open Graph tags

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Bild-Skript und CLAUDE.md

**Files:**
- Create: `scripts/prepare-image.mjs`, `scripts/prepare-image.test.mjs`, `CLAUDE.md`

**Interfaces:**
- Produces: `prepareImage(inputPath: string, outputPath: string): Promise<sharp.OutputInfo>`; CLI `npm run image -- <input> <output.jpg>`.

- [ ] **Step 1: Failing Test**

`scripts/prepare-image.test.mjs`:
```js
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepareImage } from './prepare-image.mjs';

let dir;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'prepare-image-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

async function makePng(width, height) {
  const path = join(dir, `in-${width}x${height}.png`);
  await sharp({ create: { width, height, channels: 3, background: '#c84' } }).png().toFile(path);
  return path;
}

describe('prepareImage', () => {
  it('shrinks landscape images to 2000 px width as JPEG', async () => {
    const out = join(dir, 'landscape.jpg');
    await prepareImage(await makePng(3000, 1500), out);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 2000, 1000]);
  });

  it('shrinks portrait images to 2000 px height', async () => {
    const out = join(dir, 'portrait.jpg');
    await prepareImage(await makePng(1000, 4000), out);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([500, 2000]);
  });

  it('does not enlarge small images', async () => {
    const out = join(dir, 'small.jpg');
    await prepareImage(await makePng(800, 600), out);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 800, 600]);
  });
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npx vitest run scripts/prepare-image.test.mjs`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Implementierung**

`scripts/prepare-image.mjs`:
```js
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

export const MAX_EDGE = 2000;

export async function prepareImage(inputPath, outputPath) {
  let input = await readFile(inputPath);
  if (['.heic', '.heif'].includes(extname(inputPath).toLowerCase())) {
    input = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 1 }));
  }
  return sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(outputPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Aufruf: npm run image -- <eingabe> <ausgabe.jpg>');
    process.exit(1);
  }
  const info = await prepareImage(input, output);
  console.log(`${output}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}
```

Run: `npx vitest run scripts/prepare-image.test.mjs` → PASS.

- [ ] **Step 4: HEIC real prüfen**

Run: `npm run image -- "import/Rockos white cream stew.heic" "$TMP/rocko.jpg"` (in Git Bash ist `$TMP` gesetzt; sonst Scratchpad-Pfad)
Expected: Ausgabe `…/rocko.jpg: <B>x<H>, <N> KB` mit max. 2000 px Kantenlänge.

- [ ] **Step 5: CLAUDE.md**

`CLAUDE.md`:
````markdown
# RecipeBook

Statische Rezept-Website (Astro 5, GitHub Pages). Live: https://esstobst.github.io/RecipeBook/
Sprache mit dem Nutzer: Deutsch. Jeder Push auf `main` geht sofort live – Commits und Pushes macht Claude selbstständig, aber erst wenn `npm test` und `npm run build` lokal grün sind.

## Befehle

- `npm run dev` – lokale Vorschau unter http://localhost:4321/RecipeBook/
- `npm test` – Unit-Tests (Vitest)
- `npm run build` – baut die Seite; prüft dabei Schema, Mengenmarkierungen und Tags
- `npm run image -- <eingabe> <ausgabe.jpg>` – Foto (JPG/PNG/WebP/HEIC) auf max. 2000 px verkleinern und als JPG speichern

## Rezept einlesen

Eingaben können sein: URL, PDF, Screenshot/Foto eines Rezepts, kopierter Text, dazu einzelne Fotos.

1. Rezept vollständig erfassen (URL abrufen, PDF/Bild lesen). Ein Screenshot des Rezepttexts ist **nie** das Cover.
2. Vorhandene Tags ansehen: `grep -h "^tags:" src/content/recipes/*/index.md | sort -u`. Bestehende Tags bevorzugen; neue Tags nur bewusst und dem Nutzer nennen.
3. Ordner `src/content/recipes/<slug>/` anlegen. Slug = Titel in Kleinbuchstaben, `ä→ae ö→oe ü→ue ß→ss`, alles andere außer a–z/0–9 → `-`, keine doppelten/führenden/abschließenden `-`.
4. Fotos: `npm run image -- "<foto>" src/content/recipes/<slug>/cover.jpg`; Schrittbilder als `schritt-<N>.jpg` (bei mehreren `schritt-<N>-2.jpg`). Ohne Angabe des Nutzers ist das erste Foto das Cover.
5. `index.md` nach Format und Stilrichtlinie unten schreiben. `added` = heutiges Datum.
6. Fehlende Dauer schätzen und dem Nutzer sagen. Inhaltliche Unklarheiten (fehlende Zutaten, widersprüchliche Mengen, fehlende Portionszahl) nachfragen, nicht raten.
7. `npm test && npm run build`, dann committen und pushen. Dem Nutzer den Link `https://esstobst.github.io/RecipeBook/rezepte/<slug>/` nennen (ca. 2 Min. bis live).

Bild nachreichen („Hier ist das Bild für …“): `npm run image` in den Rezeptordner, `cover: ./cover.jpg` in der Frontmatter ergänzen bzw. Bild unter den Schritt setzen, bauen, pushen.

## Format

```markdown
---
title: Mediterrane Hähnchen-Orzo
cover: ./cover.jpg            # optional
tags: [Hähnchen, Hauptspeise, OnePot]
duration: 60                  # Minuten, optional aber immer setzen
rating: 4                     # 1–5, optional (nur der Nutzer vergibt Sterne)
servings: 4
servingsLabel: Stück          # optional, Standard „Personen“
source: TikTok                # optional; URLs vollständig
added: 2026-10-08
---

## Zutaten
### Gruppe (optional)
- {{500 g}} Orzo (Kritharaki)

## Equipment
- Auflaufform (ca. 20 × 30 cm)

## Zubereitung
1. **Kurzer Titel:** Text …
   ![Beschreibung](./schritt-1.jpg)

## Tipps
- …
```

Nur `Zutaten` und `Zubereitung` sind Pflicht; erlaubte Abschnitte sind ausschließlich diese vier, in dieser Reihenfolge.

## Stilrichtlinie

**Titel:** deutsche Groß-/Kleinschreibung („Erdnusseintopf mit Borlottibohnen“), englische Eigennamen in Title Case („Rockos White Cream Stew“). Keine Abkürzungen, keine Mengen im Titel.

**Mengen-Markierung:** Alles, was mit der Portionszahl skaliert, steht in `{{…}}` – in Zutaten und Zubereitung. Nie markieren: Zeiten, Temperaturen, Maße (cm). Zusätze stehen außerhalb: `ca. {{200 g}}`. Erlaubt im Inneren: Zahl, Bruch, gemischter Bruch, Bereich, jeweils mit Leerzeichen vor der Einheit: `{{500 g}}`, `{{1,5 l}}`, `{{1/2 TL}}`, `{{4 1/8 Tassen}}`, `{{2–3 EL}}`, `{{2}}`. Bereiche mit gemeinsamer Einheit: `{{800–1000 ml}}`.

**Zutaten:**
- Format `{{Menge Einheit}} Zutat, Verarbeitung (Hinweis)` – z. B. `{{2}} Zwiebeln, fein gewürfelt`.
- Einheiten: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Prise`, `Dose`, `Bund`, `Packung`, `Stück` (nur wo nötig), `Tassen` nur wenn die Quelle so misst. Immer Leerzeichen vor der Einheit, Einheiten nie in Großbuchstaben.
- Brüche als `1/2`, Dezimalzahlen mit Komma.
- Reihenfolge der Verwendung; Grundzutaten ohne Menge (Öl, Salz, Pfeffer, Zucker, Gewürze) gesammelt am Ende, z. B. `- Öl, Salz, Pfeffer`.
- Jede Zutat aus der Zubereitung steht in der Liste und umgekehrt. Geräte gehören in `Equipment`.

**Zubereitung:**
- Jeder Schritt beginnt mit `**Kurzer Titel:**`. Ein Schritt = ein Arbeitsabschnitt, 1–4 Sätze.
- Vorbereitung (Ofen vorheizen, Fleisch temperieren) ist ein normaler erster Schritt.
- Zeiten „ca. 5 Min.“, „1 Std.“; Temperaturen „200 °C“; „mittlere Hitze“.
- Warnungen kursiv in Klammern: *(Keinen Mixer verwenden, sonst wird die Masse klebrig!)*. Sonst kein Fettdruck im Fließtext.
- Mengen im Schritt wiederholen und markieren, wenn nur ein Teil der Zutat gemeint ist oder sie zur Orientierung wichtig sind; mitwachsende Stückzahlen ebenfalls („in {{12}} Portionen teilen“).
- Neutraler Infinitiv („Zwiebeln würfeln.“), kein „du“. Letzter Schritt ist Servieren/Anrichten.

**Metadaten:** `source` kurz ohne Zusätze wie „(Screenshot)“. Inhalt immer auf Deutsch.

## Code-Überblick

- `src/content.config.ts` – Schema; `src/lib/scale.ts` – Mengen parsen/runden; `src/lib/remark-quantities.ts`, `src/lib/rehype-sections.ts` – Markdown-Plugins
- `src/pages/index.astro` + `src/scripts/overview.ts` – Übersicht; `src/pages/rezepte/[slug].astro` + `src/scripts/recipe-page.ts` – Rezeptseite
- Spec: `docs/superpowers/specs/2026-10-08-recipebook-design.md`
````

- [ ] **Step 6: Commit**

```bash
git add scripts/prepare-image.mjs scripts/prepare-image.test.mjs CLAUDE.md
git commit -m "Add image preparation script and CLAUDE.md import guide

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Notion-Migration

**Files:**
- Create: `src/content/recipes/<slug>/index.md` + `cover.jpg` für 11 Rezepte (Tabelle unten)
- Modify: `src/content/recipes/mediterrane-haehnchen-orzo/index.md` (Cover ergänzen)

**Interfaces:**
- Consumes: Format und Stilrichtlinie aus `CLAUDE.md` (Task 9), `npm run image` (Task 9).
- Quelle: `import/raw/*/Untitled/*.md` (Notion-Markdown), `import/<Titel>.<ext>` (Cover).

Die Rezepttexte werden nach `CLAUDE.md` aus der Notion-Quelle umgeschrieben. Die Quelle ist die einzige inhaltliche Grundlage; erfunden wird nichts außer den unten festgelegten Korrekturen. Frontmatter-Werte sind hier verbindlich festgelegt.

| Slug | title | Cover-Quelle (`import/…`) | tags | duration | rating | servings (Label) | source |
|---|---|---|---|---|---|---|---|
| `erdnusseintopf-mit-borlottibohnen` | Erdnusseintopf mit Borlottibohnen | `Erdnusseintopf mit borlottibohnen.jpeg` | Hello Fresh, Hauptspeise, Vegetarisch | 35 | – | 3 | HelloFresh |
| `gnocchi-in-spinat-frischkaese-sosse` | Gnocchi in Spinat-Frischkäse-Soße | `Gnocchi in Spinat-Frischkäse-Soße.jpeg` | Hauptspeise, Vegetarisch | 20 | – | 4 | HelloFresh |
| `gyros-suppe` | Gyros-Suppe | `Gyros Suppe.webp` | Schwein, Suppe | 90 | 5 | 10 | https://www.youtube.com/watch?v=e5MVXmBco_o |
| `mediterrane-haehnchen-orzo` | Mediterrane Hähnchen-Orzo | `Mediterrane Hähnchen-Orzo.heic` | Hähnchen, Hauptspeise, OnePot | 60 | 4 | 4 | TikTok |
| `nudelauflauf` | Nudelauflauf | `Nudelauflauf.jpeg` | Auflauf, Hauptspeise, Schwein | 50 | – | 3 | https://emmikochteinfach.de/nudelauflauf/ |
| `nudelsalat-mit-feta-getrockneten-tomaten-rucola` | Nudelsalat mit Feta, getrockneten Tomaten & Rucola | `Nudelsalat mit Feta, getr. Tomaten & Rucola.jpeg` | Salat, Vegetarisch | 30 | 5 | 8 | Janita |
| `ofenkartoffel-aus-der-heissluftfritteuse` | Ofenkartoffel aus der Heißluftfritteuse | `Ofenkartoffel aus der Heißluftfritteuse.jpeg` | Hauptspeise, Vegetarisch | 45 | 3 | 2 | Eigenes Rezept |
| `potato-mochis` | Potato Mochis | `Potato Mochis.jpeg` | Dessert, Kartoffel, Snack | 60 | – | 12 (Stück) | Demon Slayer |
| `rockos-white-cream-stew` | Rockos White Cream Stew | `Rockos white cream stew.heic` | Hähnchen, Hauptspeise | 45 | – | 4 (Portionen) | Pokémon-Kochbuch |
| `spaghetti-bolognese-mirco` | Spaghetti Bolognese Mirco | `Spaghetti Bolognese Mirco.jpeg` | Hauptspeise, Rind | 90 | 5 | 8 | Mirco |
| `steak-braten` | Steak braten | `Steak braten (350 g).jpeg` | Hauptspeise, Rind | 15 | 5 | 1 | Eigenes Rezept |

Alle: `added: 2026-10-08`, `cover: ./cover.jpg`.

**Inhaltliche Korrekturen (vom Nutzer freigegeben):**

| Rezept | Korrektur |
|---|---|
| Erdnusseintopf | „Sojasoße“ in die Zutaten (ohne Menge, bei den Grundzutaten am Ende). Notion-Tipp → `## Tipps`. |
| Gnocchi | Siehe vollständige Fassung unten. |
| Gyros-Suppe | Paprika (gewürfelt) mit den Zwiebeln anschmoren; Mais (abgetropft) mit den passierten Tomaten zugeben; „Chili“ als Zutat ergänzen (ohne Menge, Gewürze am Ende). `1 KG`→`{{1 kg}}`, `1 DS`→`{{1 Dose}}`, `1 L`→`{{1 l}}`. |
| Nudelauflauf | „Auflaufform ca. 20 × 30 cm“ → `## Equipment`; `0,5–1 TL Salz` → `{{1/2–1 TL}} Salz`. |
| Ofenkartoffel | `{{2}} große Kartoffeln (mehlig oder vorwiegend festkochend)`. |
| Potato Mochis | Zutaten in `### Mochis` / `### Glasur`; „in zwölf Portionen teilen. Käse in zwölf Stücke“ → `in {{12}} Portionen teilen. Käse in {{12}} Stücke`; „Nori-Blatt … in zwölf kleine Quadrate“ → `in {{12}} kleine Quadrate`; „2 EL Wasser“ → `{{2 EL}} Wasser` (Wasser ist Grundzutat ohne Liste – nur im Schritt). |
| Rockos Stew | `{{1 EL}} Mehl (zum Wenden)` und `{{30 g}} Mehl (für die Soße)` als zwei Zeilen; Schritt 3 „die restlichen {{30 g}} Mehl“. |
| Bolognese | `{{800–1000 ml}}` passierte Tomaten, `{{500–1000 ml}}` Gemüsebrühe; Abschnitt „Servieren“ → letzter Schritt; Pasta als Zutat ergänzen (ohne Menge). |
| Steak | Abschnitt „Vorbereitung“ → Schritte 1–3 der Zubereitung; „Tipps“ + „Notizen / Variationen“ → ein `## Tipps`; Equipment-Liste → `## Equipment`; Gargrad-Tabelle bleibt eingerückte Unterliste im Schritt. |
| alle | `<aside>`-Box und „Title“-Überschrift entfallen; Notion-Überschriften „Schritte:“/„Zubereitung“ → `## Zubereitung`; jeder Schritt mit `**Titel:**`. |

**Vollständige Fassung Gnocchi** (`src/content/recipes/gnocchi-in-spinat-frischkaese-sosse/index.md`):
```markdown
---
title: Gnocchi in Spinat-Frischkäse-Soße
cover: ./cover.jpg
tags: [Hauptspeise, Vegetarisch]
duration: 20
servings: 4
source: HelloFresh
added: 2026-10-08
---

## Zutaten

- {{25 g}} Pinienkerne
- {{3}} Zwiebeln, fein gewürfelt
- Knoblauch, fein gehackt
- {{4}} Karotten, in dünnen Scheiben
- {{200 g}} Babyspinat, grob zerkleinert
- {{600 g}} Gnocchi (Kühlregal)
- {{300 ml}} Gemüsebrühe
- {{100 g}} Frischkäse (z. B. Kräuter)
- {{100 g}} Tomatenpesto
- {{40 g}} Parmesan, gerieben
- Basilikum
- Öl, Salz, Pfeffer, Muskat

## Zubereitung

1. **Pinienkerne rösten:** Pinienkerne in einer großen Pfanne ohne Fett goldbraun anrösten und herausnehmen.
2. **Gemüse vorbereiten:** Zwiebeln fein würfeln, Knoblauch fein hacken. Karotten schälen und in dünne Scheiben schneiden. Spinat waschen und grob zerkleinern.
3. **Gnocchi anbraten:** Öl in der Pfanne erhitzen und die Gnocchi ca. 5 Min. anbraten.
4. **Gemüse mitbraten:** Zwiebeln, Knoblauch und Karotten zugeben und ca. 3 Min. mitbraten.
5. **Soße kochen:** Gemüsebrühe, Frischkäse und Tomatenpesto einrühren und ca. 5 Min. bei mittlerer Hitze köcheln lassen, bis die Karotten gar sind.
6. **Spinat unterheben:** Spinat unterheben und zusammenfallen lassen. Mit Salz, Pfeffer und Muskat abschmecken.
7. **Servieren:** Mit Pinienkernen, Parmesan und Basilikum bestreuen.
```

- [ ] **Step 1: Cover-Bilder umwandeln**

Run (je Zeile der Tabelle; Beispiel):
```bash
mkdir -p src/content/recipes/gyros-suppe
npm run image -- "import/Gyros Suppe.webp" src/content/recipes/gyros-suppe/cover.jpg
```
Für alle 11 Slugs wiederholen (Cover-Quelle laut Tabelle).
Expected: 11 × `cover.jpg`, jede Ausgabe ≤ 2000 px Kantenlänge. Prüfen: `ls src/content/recipes/*/cover.jpg | wc -l` → `11`.

- [ ] **Step 2: Rezepte schreiben**

Für jedes Rezept die Notion-Quelle `import/raw/*/Untitled/<Titel> <id>.md` lesen und `index.md` mit Frontmatter aus der Tabelle, Korrekturen aus der Korrekturtabelle und nach Stilrichtlinie in `CLAUDE.md` schreiben. Gnocchi exakt wie oben. Beim Orzo nur `cover: ./cover.jpg` in die Frontmatter ergänzen.

- [ ] **Step 3: Inhaltliche Prüfung je Rezept**

Für jedes Rezept gegenprüfen und in der Ausgabe kurz bestätigen:
- Jede Zutat der Liste kommt in der Zubereitung vor (Grundzutaten-Zeile ausgenommen, wenn sinngemäß verwendet) – und jede in der Zubereitung genannte Zutat steht in der Liste.
- Alle Mengen der Zutatenliste sind markiert; keine Zeit/Temperatur ist markiert.
- Jeder Schritt hat `**Titel:**`; nur erlaubte Abschnitte.
Run: `grep -L '^## Zubereitung' src/content/recipes/*/index.md` → keine Ausgabe. `grep -hE '\b[0-9]+(g|ml)\b' src/content/recipes/*/index.md` → keine Ausgabe (keine Einheit ohne Leerzeichen).

- [ ] **Step 4: Build und Sichtprüfung**

Run: `npm test && npm run build && ls dist/rezepte | wc -l`
Expected: PASS, Build ok, `11`.
`npm run dev`: Übersicht zeigt 11 Karten mit Bildern; Tags: Auflauf, Dessert, Hähnchen, Hauptspeise, Hello Fresh, Kartoffel, OnePot, Rind, Salat, Schwein, Snack, Suppe, Vegetarisch. Stichproben: Potato Mochis zeigt „12 Stück“, auf 6 gestellt → „225 g Kartoffeln“ und „in 6 Portionen teilen“; Steak-Gargradliste ist eingerückt; Bolognese auf 4 → „400–500 ml“ passierte Tomaten.

- [ ] **Step 5: Commit und Push**

```bash
git add src/content/recipes
git commit -m "Migrate 11 recipes from Notion with covers and unified style

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 11: Live-Abnahme

**Files:** keine (nur bei CI-Problemen `.github/workflows/deploy.yml`)

- [ ] **Step 1: Deploy-Status prüfen**

Run: `curl -s "https://api.github.com/repos/EsstObst/RecipeBook/actions/runs?per_page=1" | grep -E '"(status|conclusion|head_sha)"'`
Expected: `head_sha` = `git rev-parse HEAD`, `conclusion: success`.
Falls der Build in CI an `sharp` scheitert („Could not load the sharp module … linux-x64“): in `deploy.yml` nach `npm ci` den Schritt `- run: npm install --no-save --os=linux --cpu=x64 sharp@0.34.5` einfügen, committen, pushen, erneut prüfen.

- [ ] **Step 2: Live-Seiten prüfen**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://esstobst.github.io/RecipeBook/
curl -s -o /dev/null -w "%{http_code}\n" https://esstobst.github.io/RecipeBook/rezepte/potato-mochis/
curl -s -o /dev/null -w "%{http_code}\n" https://esstobst.github.io/RecipeBook/manifest.webmanifest
```
Expected: dreimal `200`.

- [ ] **Step 3: Übergabe an den Nutzer**

Dem Nutzer den Link nennen und um Prüfung auf dem Handy bitten: Portionen umstellen, abhaken, „Bildschirm an“, „Zum Home-Bildschirm hinzufügen“, Link per WhatsApp teilen (Vorschau mit Bild).
