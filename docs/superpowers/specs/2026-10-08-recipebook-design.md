# RecipeBook – Design

Datum: 2026-10-08
Status: Entwurf zur Freigabe

## Ziel

Eine eigene Rezept-Website als Ersatz für die bisherige Notion-Datenbank. Rezepte werden ausschließlich über Claude eingelesen (Repo-Dateien + Push); die Website ist read-only, ohne Login, öffentlich, auf jedem Endgerät nutzbar (Schwerpunkt: Handy beim Kochen) und kostenlos gehostet. Jeder Push auf `main` geht direkt live – es gibt keine Testumgebung.

**Erfolgskriterium:** Der Nutzer gibt Claude ein Rezept (URL, PDF, Bild, Text, Fotos); wenige Minuten später ist es live, im einheitlichen Stil, und auf dem Handy lässt sich die Personenzahl umstellen, wobei Zutaten- und Schrittmengen korrekt umgerechnet werden.

Das System soll offen für spätere Features bleiben, Version 1 enthält aber nur den hier beschriebenen Umfang.

## Architektur

- **Astro** als statischer Site-Generator, TypeScript.
- **Hosting:** GitHub Pages, Repo `EsstObst/RecipeBook` (wird öffentlich gestellt). URL: `https://esstobst.github.io/RecipeBook/` (Astro `base: '/RecipeBook'`; alle internen Links und Assets berücksichtigen die Base).
- **Deployment:** GitHub-Actions-Workflow führt bei jedem Push auf `main` `npm test` und `npm run build` aus und veröffentlicht auf Pages. Schlägt ein Schritt fehl, bleibt die vorherige Version online.
- Keine Datenbank, kein Server. Alle Inhalte sind Dateien im Repo.
- Clientseitiges JavaScript nur für: Portionsumrechnung, Abhaken, Bildschirm-wach-Schalter, Tag-Filter/Suche/Sortierung, Dark-Mode-Umschalter, Bild-Großansicht.

```
Nutzer → Claude → Rezeptordner (index.md + Bilder) → npm test + npm run build (lokal) → git push
       → GitHub Action: test + build → GitHub Pages
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

Ordnername = Slug = URL: Kleinbuchstaben, `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, Leer- und Sonderzeichen → `-`. Der Slug ändert sich nicht, wenn der Titel später angepasst wird.

```markdown
---
title: Mediterrane Hähnchen-Orzo
cover: ./cover.jpg
tags: [Hähnchen, Hauptspeise, OnePot]
duration: 60
rating: 4
servings: 4
source: TikTok
added: 2026-10-08
---

## Zutaten
- {{4 Stück}} Pollo-Fino (Hähnchenschenkel, entbeint)
- {{500 g}} Orzo (Kritharaki)
- Salz, Pfeffer

## Zubereitung
1. **Hähnchen anbraten:** … bei starker Hitze 3–4 Min. goldbraun anbraten …
2. **Orzo garen:** Orzo kurz anrösten. {{4 1/8 Tassen}} Gemüsebrühe nach und nach zugießen …
   ![Orzo angeröstet](./schritt-2.jpg)

## Tipps
- Freier Markdown-Inhalt.
```

### Frontmatter-Schema (Astro Content Collection, zod)

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `title` | string | ja | Rezeptname |
| `servings` | int ≥ 1 | ja | Menge, auf die sich die Zutaten beziehen |
| `servingsLabel` | string | nein (Standard „Personen“) | Einheit der Portionswahl, z. B. „Stück“, „Portionen“ |
| `tags` | string[] | ja (darf leer sein) | Freie Tags |
| `added` | date | ja | Datum des Einlesens, für Sortierung |
| `cover` | image | nein | Vorschaubild / Banner |
| `duration` | int (Minuten) | nein | Gesamtdauer inkl. Garzeit, ohne Wartezeiten wie „über Nacht“ |
| `rating` | int 1–5 | nein | Sterne |
| `source` | string | nein | Quelle; beginnt sie mit `http`, wird sie als Link dargestellt |

Build-Fehler bei: Schema-Verstoß; Tags, die sich nur in Groß-/Kleinschreibung unterscheiden (rezeptübergreifend, z. B. „Vegetarisch“ vs. „vegetarisch“); unparsbarem `{{…}}`-Inhalt.

### Body-Struktur

Feste Abschnitte in dieser Reihenfolge (nur `Zutaten` und `Zubereitung` sind Pflicht):

1. `## Zutaten` – Liste. Optional unterteilt mit `### Gruppenname` (z. B. „Mochis“, „Glasur“).
2. `## Equipment` – optional, Liste besonderer Geräte (Auflaufform 20×30 cm, Gusseisenpfanne, Thermometer). Gewöhnliches (Topf, Messer) wird nicht aufgeführt.
3. `## Zubereitung` – nummerierte Liste. Optional unterteilt mit `### Gruppenname`. Schritte dürfen eingerückte Unterlisten (z. B. Gargrad-Tabelle) und Bilder enthalten.
4. `## Tipps` – optional, Liste: Tipps, Varianten, Beilagen-Ideen.

Weitere Abschnitte sind nicht vorgesehen; alles Zusätzliche gehört in `Tipps`.

- Mengen, die mit der Portionszahl skalieren, stehen in `{{…}}` – in Zutaten **und** Zubereitung. Nur Mengen werden markiert; Zeiten, Temperaturen, Maße (cm) nie. Zusätze wie „ca.“ stehen außerhalb: `ca. {{200 g}}`.
- Bilder in Schritten: Markdown-Bild(er) eingerückt unter dem Listenpunkt. Mehrere Bilder unter einem Schritt erscheinen nebeneinander (Handy: untereinander).

## Stilrichtlinie für Rezepte

Gilt für jedes neu eingelesene und jedes migrierte Rezept. Sie steht verbindlich in `CLAUDE.md`.

**Titel**
- Deutsche Groß-/Kleinschreibung bei deutschen Titeln („Erdnusseintopf mit Borlottibohnen“); englische Eigennamen in Title Case („Rockos White Cream Stew“).
- Keine Abkürzungen („getrockneten“ statt „getr.“), keine Mengen im Titel („Steak braten“ statt „Steak braten (350 g)“).

**Zutaten**
- Format: `{{Menge Einheit}} Zutat, Verarbeitung (Hinweis)` – z. B. `{{2}} Zwiebeln, fein gewürfelt`, `{{100 g}} Käse, gerieben (z. B. Gouda)`.
- Einheiten einheitlich: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Prise`, `Dose`, `Bund`, `Packung`, `Stück` (nur wo nötig), `Tassen` nur wenn die Quelle so misst. Immer mit Leerzeichen („20 g“, nicht „20g“). Keine Großschreibung von Einheiten („kg“, nicht „KG“; „Dose“, nicht „DS“).
- Bereiche mit Halbgeviertstrich und gemeinsamer Einheit: `{{800–1000 ml}}`, nicht „800 ml – 1 l“.
- Brüche als `1/2`, Dezimalzahlen mit Komma.
- Reihenfolge: in der Reihenfolge der Verwendung; Grundzutaten ohne Menge (Öl, Salz, Pfeffer, Zucker) gesammelt am Ende, z. B. `- Salz, Pfeffer`.
- Jede Zutat, die in der Zubereitung vorkommt, steht in der Zutatenliste – und umgekehrt.
- Keine Geräte in der Zutatenliste (→ `Equipment`).

**Zubereitung**
- Jeder Schritt beginnt mit einem kurzen fetten Titel mit Doppelpunkt: `**Gemüse vorbereiten:** …`.
- Ein Schritt = ein Arbeitsabschnitt, 1–4 Sätze. Vorbereitung (Ofen vorheizen, Fleisch temperieren) ist normaler erster Schritt, kein eigener Abschnitt.
- Zeiten als „ca. 5 Min.“ / „1 Std.“, Temperaturen als „200 °C“, Hitzestufen „mittlere Hitze“.
- Wichtige Warnungen kursiv in Klammern: *(Keinen Mixer verwenden, sonst wird die Masse klebrig!)* – sparsam, keine Fettung im Fließtext außer dem Schritt-Titel.
- Mengen, die sich auf Zutaten beziehen, werden im Schritt wiederholt und markiert, wenn sie nur einen Teil der Zutat betreffen („{{250 ml}} der Brühe“) oder zur Orientierung wichtig sind; Stückzahlen, die mit der Portionszahl wachsen, ebenfalls („in {{12}} Portionen teilen“).
- Anrede neutral im Imperativ-Infinitiv („Zwiebeln würfeln.“), kein „du“.
- Servieren/Anrichten ist der letzte Schritt.

**Metadaten**
- `source`: kurz und ohne Zusätze wie „(Screenshot)“; URLs vollständig.
- `duration` immer setzen; fehlt sie in der Quelle, schätzt Claude sie und weist den Nutzer darauf hin.
- Inhaltliche Unklarheiten (fehlende Zutaten, widersprüchliche Mengen) werden dem Nutzer vorgelegt, nicht stillschweigend geraten.

## Portionsumrechnung

Eigenständiges, reines TypeScript-Modul `src/lib/scale.ts` ohne DOM-Abhängigkeit.

- **Parsing** des `{{…}}`-Inhalts: Zahl (`500`, `1,5`, `1.5`), Bruch (`1/2`), gemischter Bruch (`4 1/8`), Bereich (`2–3`, `2-3`), jeweils optional gefolgt von einer Einheit (beliebiger Text, z. B. `g`, `Tassen`, `Stück`). Unparsbarer Inhalt (z. B. `{{eine Handvoll}}`) → Build-Fehler mit Rezeptname und Inhalt.
- **Rechnung:** neu = original × (gewählt ÷ `servings`). Bereiche: beide Grenzen skaliert.
- **Anzeige-Rundung nach Einheit:**
  - `g`, `ml`: < 10 → ganze Zahl, sonst 5er-Schritte
  - `kg`, `l`: eine Nachkommastelle, deutsches Komma
  - `Tasse(n)`, `EL`, `TL`, `Prise(n)`, `Msp`, `Bund`, `Dose(n)`, `Packung(en)`: Bruch auf ¼ genau (`1 ½`, `¾`)
  - `Stück` / ohne Einheit / unbekannte Einheit: auf ½ genau
  - **Nie 0:** Ergibt die Rundung 0, wird der kleinste Schritt der Einheitengruppe angezeigt (1 g/ml, 0,1 kg/l, ¼).
- Bei gewählter = Original-Portionszahl wird exakt der Originaltext angezeigt.
- Keine Einheitenumrechnung (g ↔ kg), keine grammatische Anpassung („1 Zwiebeln“ ist akzeptiert).

**Rendering:** Ein remark-Plugin ersetzt `{{…}}` beim Build durch `<span class="qty" data-value=… data-value-max=… data-unit=…>Originaltext</span>`. Das Client-Skript der Rezeptseite liest diese Spans und schreibt bei Änderung der Portionszahl die formatierten Werte hinein; umgerechnete Werte werden dezent hervorgehoben.

## Seiten

### Übersicht `/`

- Suche (Titel und Zutaten), Tag-Chips (Mehrfachauswahl, UND-Verknüpfung), Sortierauswahl.
- Sortierungen: Name A–Z (Standard), Bewertung (beste zuerst), Dauer (kürzeste zuerst), zuletzt hinzugefügt. Rezepte ohne Wert für das Sortierfeld stehen am Ende; bei Gleichstand wird nach Name sortiert.
- Filter-, Such- und Sortierzustand in der URL (`?tags=Hähnchen,OnePot&sort=rating&q=orzo`).
- Kartenraster: Vorschaubild (oder Platzhalter), Titel, Sterne, Dauer. Responsive: 1 Spalte (Handy) bis 3–5 Spalten (Desktop).
- Alle Rezeptdaten für Filter/Suche werden beim Build als kleines JSON in die Seite eingebettet.

### Rezeptseite `/rezepte/<slug>/`

- Banner aus `cover` (oder Platzhalter), Titel, Dauer, Sterne, Quelle, Tags (Links zur gefilterten Übersicht).
- Portionswahl `[−] N <servingsLabel> [+]` (1–99) mit Reset auf Original. Auf dem Handy bleibt die Portionswahl beim Scrollen am oberen Rand sichtbar (sticky).
- **Bildschirm wach halten:** Schalter auf der Rezeptseite nutzt die Screen Wake Lock API; wird nach Tab-Wechsel automatisch erneut angefordert. Ohne Browser-Unterstützung wird der Schalter ausgeblendet.
- **Abhaken:** Antippen einer Zutat oder eines Schritts streicht sie durch. Zustand pro Rezept in `localStorage` (try/catch, ohne Storage funktioniert die Seite trotzdem); Button „Alles zurücksetzen“.
- Handy: Zutaten, Equipment, Zubereitung, Tipps untereinander. Desktop: Zutaten + Equipment in sticky linker Spalte, Zubereitung + Tipps rechts.
- Schrittbilder per Klick in Großansicht.

### Allgemein

- Oberfläche auf Deutsch.
- Dark Mode: folgt standardmäßig der Systemeinstellung, Umschalter im Header, Auswahl in `localStorage` (try/catch).
- Platzhalter für fehlende Bilder: neutrale, zum Theme passende Fläche.
- Bilder werden über Astro `<Image>` beim Build optimiert (responsive Größen, moderne Formate).
- **Web-App-Manifest + Icon:** Seite lässt sich auf dem Handy-Homescreen ablegen und startet ohne Browserleiste (`display: standalone`). Kein Service Worker / kein Offline-Modus.
- **Link-Vorschau:** Open-Graph-/Twitter-Meta-Tags (Titel, Beschreibung, Cover-Bild) auf jeder Rezeptseite und der Übersicht.

## Einlesen über Claude

Eine `CLAUDE.md` im Repo beschreibt den Einleseprozess und die Stilrichtlinie verbindlich:

- **Eingaben:** URL (abrufen, Rezept extrahieren, `source` = URL), PDF, Bild/Screenshot eines Rezepts (Text lesen; Screenshot wird *nicht* zum Cover), Copy-Paste-Text, dazu einzelne Fotos. Der Nutzer sagt, welches Foto Cover ist und welches zu welchem Schritt gehört; ohne Angabe ist das erste Foto das Cover.
- **Normalisierung:** Inhalt auf Deutsch, gemäß Stilrichtlinie, `added` = heutiges Datum, vorhandene Tags bevorzugen (bestehende Tag-Liste vorher prüfen; neue Tags nur bewusst und mit Hinweis an den Nutzer).
- **Bilder:** Skript `scripts/prepare-image.mjs` (sharp; HEIC über `heic-convert`) wandelt JPG/PNG/WebP/HEIC um, verkleinert auf max. 2000 px Kantenlänge und speichert als JPG (Qualität ~85) in den Rezeptordner.
- **Nachreichen:** Cover oder Schrittbilder können jederzeit nachträglich hinzugefügt werden („Hier ist das Bild für die Orzo“).
- **Ablauf je Änderung:** Datei(en) anlegen/ändern → `npm test` und `npm run build` lokal → Commit → Push auf `main`.

## Notion-Migration (Teil von Version 1)

Quelle: `import/notion-export.zip` (entpackt nach `import/raw/`) und Cover-Bilder `import/<Rezepttitel>.<jpeg|webp|heic>`. `import/` steht in `.gitignore`. Die Migration ist eine einmalige, von Claude durchgeführte Umwandlung (kein dauerhaftes Skript im Repo).

- 11 Rezepte werden übernommen; die leere Vorlage „Untitled“ wird übersprungen.
- Felder: `Dauer` → `duration`, `Rating` (⭐-Anzahl) → `rating`, `Tags` → `tags` (gemappt), `Quelle:` → `source`, `Personen:` → `servings`/`servingsLabel`. `added` = 2026-10-08. Die Notion-Box (`<aside>`) entfällt, ihr Inhalt geht in die Frontmatter.
- Jedes Rezept wird vollständig nach der Stilrichtlinie überarbeitet (Titel, Einheiten, Zutatenreihenfolge, Schritt-Titel, Abschnitte, `{{…}}`-Markierungen).
- **Cover:** 10 Bilder vorhanden (2× HEIC). Für „Nudelsalat mit Feta, getrockneten Tomaten & Rucola“ fehlt ein Bild → Platzhalter.
- **Tag-Mapping:**

  | Notion | neu |
  |---|---|
  | Main dish | Hauptspeise |
  | Hänchen | Hähnchen |
  | Hello fresh | Hello Fresh |
  | Auflauf, Dessert, Kartoffel, OnePot, Rind, Salat, Schwein, Snack, Suppe, Vegetarisch | unverändert |

- **Inhaltliche Korrekturen** (vom Nutzer bestätigt, siehe unten):

  | Rezept | Problem | Korrektur |
  |---|---|---|
  | Erdnusseintopf | Sojasoße in Schritten, fehlt in Zutaten; keine Dauer | Sojasoße ergänzen; `duration` 35 |
  | Gnocchi | Tomaten in Schritt 7, fehlen in Zutaten; Frischkäse wird zweimal zugegeben; Karotten/Knoblauch nie verarbeitet; Parmesan/Basilikum ungenutzt; 250 vs. 300 ml Brühe; Öl/Muskat fehlen | Schritte so ordnen, dass jede Zutat genau einmal verwendet wird; Tomaten-Erwähnung streichen; Parmesan + Basilikum zum Servieren; 300 ml Brühe; Öl, Salz, Pfeffer, Muskat ergänzen |
  | Gyros-Suppe | Mais und Paprika nie verarbeitet; Chili verwendet, aber nicht gelistet | Paprika mit den Zwiebeln, Mais mit den Tomaten zugeben; Chili ergänzen |
  | Nudelauflauf | `Personen: —`; keine Dauer; Auflaufform in Zutaten | `servings` 3; `duration` 50; Auflaufform → Equipment |
  | Ofenkartoffel | `Personen: 1–2` | `servings` 2, `{{2}}` große Kartoffeln |
  | Potato Mochis | „12 Stück“; „zwölf Portionen“ im Text skaliert nicht | `servings` 12, `servingsLabel` Stück; „in {{12}} Portionen teilen“ |
  | Rockos Stew | „1 EL Mehl + 30 g (für später)“ | zwei Zeilen: `{{1 EL}} Mehl (zum Wenden)`, `{{30 g}} Mehl (für die Soße)` |
  | Bolognese | keine Personenzahl; Bereiche mit gemischten Einheiten | `servings` 6; `{{800–1000 ml}}`, `{{500–1000 ml}}` |
  | Steak | Menge im Titel; Abschnitte Vorbereitung/Tipps/Notizen | Titel „Steak braten“; Vorbereitung als erste Schritte; Tipps + Notizen zusammenführen |

## Qualitätssicherung

- Unit-Tests (Vitest) für `src/lib/scale.ts`: Parsing aller Formate, Bereiche, Rundungsregeln je Einheitengruppe, Nie-0-Regel, Fehlerfall.
- Schema-Validierung, Tag-Duplikat-Prüfung und `{{…}}`-Parsing im Build fangen fehlerhafte Rezeptdateien ab.
- CI-Workflow führt `npm test` und `npm run build` vor dem Deploy aus.
- Bewusst keine Browser-/E2E-Tests und keine Testumgebung.

## Einmalige manuelle Schritte des Nutzers

1. Repo `EsstObst/RecipeBook` auf öffentlich stellen.
2. In den Repo-Einstellungen → Pages → Source: „GitHub Actions“ wählen.

## Nicht in Version 1

Ideen für später: Timer aus Zeitangaben in Schritten, „Was koche ich heute?“ (Zufallsrezept), Resteverwertung (Suche nach vorhandenen Zutaten), Einkaufsliste über mehrere Rezepte, Wochenplan, Kochmodus (ein Schritt pro Bildschirm), „Zuletzt geändert“ aus der Git-Historie.

Ausgeschlossen: Tag-Gruppierung, Einheitenumrechnung, grammatische Anpassung bei Skalierung, Offline-Modus, eigene Domain, Authentifizierung, Bearbeiten über die Website.
