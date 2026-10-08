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
7. **Plausi-Check** (bei jedem neuen oder geänderten Rezept): Mengen pro Portion realistisch? Fehlen Mengen, die man zum Kochen braucht (z. B. Wasser für Reis, Nudelmenge)? Wird jede Zutat verwendet und jede verwendete Zutat aufgeführt? Garzeiten, Temperaturen und Reihenfolge stimmig? Passen Tags und Dauer? Reine Stilfehler direkt korrigieren; inhaltliche Verbesserungsvorschläge dem Nutzer kurz auflisten und erst nach seinem OK umsetzen.
8. `npm test && npm run build`, dann committen und pushen. Dem Nutzer den Link `https://esstobst.github.io/RecipeBook/rezepte/<slug>/` nennen (ca. 2 Min. bis live).

Gekocht melden („Hab X gekocht, 4 Sterne“): `rating` setzen, bauen, pushen. Ein Rezept gilt als gekocht, sobald es Sterne hat (Filter „Noch nicht gekocht“). Ohne Sternangabe nachfragen.

Bild nachreichen („Hier ist das Bild für …“): `npm run image` in den Rezeptordner, `cover: ./cover.jpg` in der Frontmatter ergänzen bzw. Bild unter den Schritt setzen, bauen, pushen.

## Format

```markdown
---
title: Mediterrane Hähnchen-Orzo
cover: ./cover.jpg            # optional
tags: [Hähnchen, Hauptspeise, OnePot]
duration: 60                  # Minuten, optional aber immer setzen
rating: 4                     # 1–5, optional (nur der Nutzer vergibt Sterne; Rezept mit Sternen = schon gekocht)
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
- Einheiten: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Prise`, `Dose`, `Bund`, `Packung`, `Päckchen`, `Zweig`, `Stück` (nur wo nötig), `Tassen` nur wenn die Quelle so misst. Immer Leerzeichen vor der Einheit, Einheiten nie in Großbuchstaben.
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
