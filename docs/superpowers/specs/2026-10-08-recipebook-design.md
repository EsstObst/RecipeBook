# RecipeBook – Design

Datum: 2026-10-08
Status: Entwurf zur Freigabe

## Ziel

Eine eigene Rezept-Website als Ersatz für die bisherige Notion-Datenbank. Rezepte werden ausschließlich über Claude eingelesen (Repo-Dateien + Push); die Website ist read-only, ohne Login, öffentlich, auf jedem Endgerät nutzbar und kostenlos gehostet. Jeder Push auf `main` geht direkt live – es gibt keine Testumgebung.

**Erfolgskriterium:** Der Nutzer gibt Claude ein Rezept (URL, PDF, Bild, Text, Fotos); wenige Minuten später ist es live, und auf dem Handy lässt sich die Personenzahl umstellen, wobei Zutaten- und Schrittmengen korrekt umgerechnet werden.

Das System soll offen für spätere Features bleiben, Version 1 enthält aber nur den hier beschriebenen Umfang.

## Architektur

- **Astro** als statischer Site-Generator, TypeScript.
- **Hosting:** GitHub Pages, Repo `EsstObst/RecipeBook` (wird öffentlich gestellt). URL: `https://esstobst.github.io/RecipeBook/` (Astro `base: '/RecipeBook'`).
- **Deployment:** GitHub-Actions-Workflow baut bei jedem Push auf `main` und veröffentlicht auf Pages. Schlägt der Build fehl, bleibt die vorherige Version online.
- Keine Datenbank, kein Server. Alle Inhalte sind Dateien im Repo.
- Clientseitiges JavaScript nur für: Portionsumrechnung, Tag-Filter/Suche/Sortierung, Dark-Mode-Umschalter, Bild-Großansicht.

```
Nutzer → Claude → Rezeptordner (index.md + Bilder) → npm run build (lokal) → git push
       → GitHub Action: astro build → GitHub Pages
```

## Rezeptformat

Ein Ordner pro Rezept, Bilder daneben:

```
src/content/recipes/
  mediterrane-haehnchen-orzo/
    index.md
    cover.jpg          (optional)
    schritt-2.jpg      (optional, beliebig viele)
```

Ordnername = Slug = URL: Kleinbuchstaben, `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, Leer- und Sonderzeichen → `-`.

```markdown
---
title: Mediterrane Hähnchen-Orzo
cover: ./cover.jpg
tags: [Hähnchen, OnePot, Hauptspeise]
duration: 60
rating: 4
servings: 4
source: TikTok (Screenshot)
added: 2026-10-08
---

## Zutaten
- {{4 Stück}} Pollo-Fino (Hühnerschenkel, entbeint)
- Bratolivenöl (z. B. Bertolli)
- {{500 g}} Orzo (Kritharaki)

## Schritte
1. Hähnchen … bei starker Hitze 3–4 Min. goldbraun anbraten …
2. Orzo kurz anrösten. {{4 1/8 Tassen}} Gemüsebrühe nach und nach zugießen …
   ![Orzo angeröstet](./schritt-2.jpg)

## Notizen
Freier Markdown-Inhalt (optional).
```

### Frontmatter-Schema (Astro Content Collection, zod)

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `title` | string | ja | Rezeptname |
| `servings` | int ≥ 1 | ja | Personenzahl, auf die sich die Mengen beziehen |
| `tags` | string[] | ja (darf leer sein) | Freie Tags |
| `added` | date | ja | Datum des Einlesens, für Sortierung |
| `cover` | image | nein | Vorschaubild / Banner |
| `duration` | int (Minuten) | nein | Gesamtdauer |
| `rating` | int 1–5 | nein | Sterne |
| `source` | string | nein | Quelle; beginnt sie mit `http`, wird sie als Link dargestellt |

Ein Verstoß gegen das Schema bricht den Build ab.

### Body-Konventionen

- `## Zutaten` (Liste) und `## Schritte` (nummerierte Liste) sind die Standardabschnitte. Weitere Abschnitte (`## Notizen` usw.) sind freier Markdown und werden normal gerendert.
- Mengen, die mit der Personenzahl skalieren, stehen in `{{…}}` – in Zutaten **und** Schritten. Nur Mengen werden markiert; Zeiten, Temperaturen o. Ä. nie.
- Bilder in Schritten: Markdown-Bild(er) eingerückt unter dem Listenpunkt. Mehrere Bilder unter einem Schritt erscheinen nebeneinander (Handy: untereinander).

## Portionsumrechnung

Eigenständiges, reines TypeScript-Modul `src/lib/scale.ts` ohne DOM-Abhängigkeit.

- **Parsing** des `{{…}}`-Inhalts: Zahl (`500`, `1,5`, `1.5`), Bruch (`1/2`), gemischter Bruch (`4 1/8`), Bereich (`2–3`, `2-3`), jeweils optional gefolgt von einer Einheit (beliebiger Text, z. B. `g`, `Tassen`, `Stück`). Unparsbarer Inhalt (z. B. `{{eine Handvoll}}`) → Build-Fehler mit Rezeptname und Inhalt.
- **Rechnung:** neu = original × (gewählt ÷ `servings`). Bereiche: beide Grenzen skaliert.
- **Anzeige-Rundung nach Einheit:**
  - `g`, `ml`: < 10 → ganze Zahl, sonst 5er-Schritte
  - `kg`, `l`: eine Nachkommastelle, deutsches Komma
  - `Tasse(n)`, `EL`, `TL`, `Prise(n)`, `Msp`, `Bund`, `Dose(n)`: Bruch auf ¼ genau (`1 ½`, `¾`)
  - `Stück` / ohne Einheit / unbekannte Einheit: auf ½ genau; Ergebnis < ½ → `¼`
- Bei gewählter = Original-Personenzahl wird exakt der Originaltext angezeigt.
- Keine Einheitenumrechnung (g ↔ kg).

**Rendering:** Ein remark-Plugin ersetzt `{{…}}` beim Build durch `<span class="qty" data-value=… data-value-max=… data-unit=…>Originaltext</span>`. Das Client-Skript der Rezeptseite liest diese Spans und schreibt bei Änderung der Personenzahl die formatierten Werte hinein; umgerechnete Werte werden dezent hervorgehoben.

## Seiten

### Übersicht `/`

- Suche (Titel und Zutaten), Tag-Chips (Mehrfachauswahl, UND-Verknüpfung), Sortierauswahl.
- Sortierungen: Name A–Z (Standard), Bewertung (beste zuerst), Dauer (kürzeste zuerst), zuletzt hinzugefügt. Rezepte ohne Wert für das Sortierfeld stehen am Ende.
- Filter-, Such- und Sortierzustand in der URL (`?tags=Hähnchen,OnePot&sort=rating&q=orzo`).
- Kartenraster: Vorschaubild (oder Platzhalter), Titel, Sterne, Dauer. Responsive: 1 Spalte (Handy) bis 3–5 Spalten (Desktop).
- Alle Rezeptdaten für Filter/Suche werden beim Build als kleines JSON in die Seite eingebettet.

### Rezeptseite `/rezepte/<slug>/`

- Banner aus `cover` (oder Platzhalter), Titel, Dauer, Sterne, Quelle, Tags (Links zur gefilterten Übersicht).
- Portionswahl `[−] N Personen [+]` (1–99) mit Reset auf Original.
- Handy: Zutaten, dann Schritte, untereinander. Desktop: Zutaten in sticky linker Spalte, Schritte rechts.
- Bilder (Schrittbilder) per Klick in Großansicht.

### Allgemein

- Oberfläche auf Deutsch.
- Dark Mode: folgt standardmäßig der Systemeinstellung, Umschalter im Header, Auswahl in `localStorage` (mit try/catch; ohne Storage funktioniert die Seite trotzdem).
- Platzhalter für fehlende Bilder: neutrale, zum Theme passende Fläche.
- Bilder werden über Astro `<Image>` beim Build optimiert (responsive Größen, moderne Formate).

## Einlesen über Claude

Eine `CLAUDE.md` im Repo beschreibt den Einleseprozess verbindlich:

- **Eingaben:** URL (abrufen, Rezept extrahieren, `source` = URL), PDF, Bild/Screenshot eines Rezepts (Text lesen; Screenshot wird *nicht* zum Cover), Copy-Paste-Text, dazu einzelne Fotos. Der Nutzer sagt, welches Foto Cover ist und welches zu welchem Schritt gehört; ohne Angabe ist das erste Foto das Cover.
- **Normalisierung:** Inhalt auf Deutsch, Format wie oben, Mengen mit `{{…}}`, `added` = heutiges Datum, vorhandene Tags bevorzugen (bestehende Tag-Liste vorher prüfen; neue Tags nur bewusst).
- **Bilder:** Skript `scripts/prepare-image.mjs` (sharp) verkleinert auf max. 2000 px Kantenlänge und speichert als JPG (Qualität ~85) in den Rezeptordner.
- **Nachreichen:** Cover oder Schrittbilder können jederzeit nachträglich hinzugefügt werden („Hier ist das Bild für die Orzo“).
- **Ablauf je Änderung:** Datei(en) anlegen/ändern → `npm run build` und `npm test` lokal → Commit → Push auf `main`.

## Notion-Migration (Teil von Version 1)

Quelle: `import/notion-export.zip` (entpackt nach `import/raw/`). `import/` steht in `.gitignore`.

- 11 Rezepte werden übernommen; die leere Vorlage „Untitled“ wird übersprungen.
- Felder: Titel aus `# …`, `Dauer` → `duration`, `Rating` (⭐-Anzahl) → `rating`, `Tags` → `tags` (gemappt), `Quelle:` → `source`, `Personen:` → `servings`. Fehlt `Personen`, wird der Nutzer gefragt. `added` = 2026-10-08.
- Zutaten und Schritte werden übernommen und die Mengen mit `{{…}}` markiert. Die Notion-Box (`<aside>` mit „Title“) entfällt, ihr Inhalt geht in die Frontmatter.
- **Tag-Mapping:**

  | Notion | neu |
  |---|---|
  | Main dish | Hauptspeise |
  | Hänchen | Hähnchen |
  | Hello fresh | Hello Fresh |
  | alle übrigen (Auflauf, Dessert, Kartoffel, OnePot, Rind, Salat, Schwein, Snack, Suppe, Vegetarisch) | unverändert |

- **Bilder:** Der Notion-Export enthält keine Titelbilder. Alle migrierten Rezepte starten mit Platzhalter; der Nutzer reicht Bilder später nach.

## Qualitätssicherung

- Unit-Tests (Vitest) für `src/lib/scale.ts`: Parsing aller Formate, Bereiche, Rundungsregeln je Einheitengruppe, Fehlerfall.
- Schema-Validierung und `{{…}}`-Parsing im Build fangen fehlerhafte Rezeptdateien ab.
- CI-Workflow führt `npm test` und `npm run build` vor dem Deploy aus.
- Bewusst keine Browser-/E2E-Tests und keine Testumgebung.

## Einmalige manuelle Schritte des Nutzers

1. Repo `EsstObst/RecipeBook` auf öffentlich stellen.
2. In den Repo-Einstellungen → Pages → Source: „GitHub Actions“ wählen.

## Nicht in Version 1

Kochmodus (Bildschirm wach halten), Einkaufsliste, Favoriten, Zutaten abhaken, Tag-Gruppierung, Einheitenumrechnung, eigene Domain, Authentifizierung, Bearbeiten über die Website.
