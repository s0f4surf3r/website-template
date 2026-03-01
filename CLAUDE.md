# Website-Template

Dieses Projekt ist das Template für alle Marken-Websites. Wenn Jochen "neue Seite", "neue Website" oder ähnliches sagt → diesen Workflow durchgehen.

## Arbeitsweise

- Direkt, kein Chi-Chi, keine Wiederholungen
- Apple HIG, Minimalismus, Reduktion, Authentizität
- Kein neoliberaler Style, kein Marketing-Sprech
- **Nicht automatisch deployen** — nur auf ausdrücklichen Wunsch
- **Git ZUERST** — immer `git init` + GitHub-Repo (public) BEVOR Hosting

---

## Workflow: Neue Website starten

### Schritt 1 — Briefing (ich frage)

- **Für wen?** Name, Marke, Kontext
- **Kurzbeschreibung** der Person/Marke (1-2 Sätze)
- **Welche Sprachen?** (DE/EN/PT oder andere Kombi)
- **Bestehende Online-Präsenz?** Instagram-Handle → `instaloader` für Captions/Fotos/Ton (Profil muss öffentlich sein)
- **Seitentyp?**
  - **Multi-Page** (Standard) — Eigene URLs pro Seite, echte Navigation. SEO-freundlich, skalierbar.
  - **Landing Page** — Eine einzelne Seite, ein Ziel (z.B. "Buch mein Coaching"). Kein Nav-Labyrinth, bewusst reduziert.
  - **NIEMALS One-Pager/Endlosscroll** — Fake-Menü das nur runterscrollt. Bauen wir nicht.
- **Wird regelmäßig Content produziert?** (Blog, Essays, Gedichte, Rennberichte, Rezepte...)
  - Nein → Statische Seiten reichen, kein CMS nötig
  - Ja → **perfectCMS** einbauen (eigenes Projekt, siehe `/Users/joho21/Projekte/perfectCMS/`)
  - Kunde öffnet `/admin`, loggt sich per E-Mail (Login-Link) oder Passwort ein, schreibt Markdown, klickt Veröffentlichen
  - Kein GitHub-Account nötig, kein Drittanbieter-Login
  - Setup: `admin/`-Ordner ins Kunden-Repo nach `src/admin/` kopieren, Scaleway Function pro Kunde deployen
  - **Jeder Kunde bekommt CMS** — selbst "statische" Seiten brauchen Edit-Möglichkeit (Preise, Texte ändern)

### Schritt 2 — Farbpalette (Bild → HTML → CSS)

1. Jochen fragen: "Zeig mir ein Referenzbild für die Farbpalette"
2. Bild analysieren, dominante Farben extrahieren
3. `farbpalette.html` im Projektordner generieren (Format: siehe `farbpalette.html` in diesem Repo)
4. Im Browser öffnen: `open farbpalette.html`
5. Jochen bestätigt oder korrigiert
6. Bestätigte Farben als CSS Custom Properties in `style.css` setzen (die 7 Variablen)

#### Mehrere Paletten & Theme-Switcher

- **Option anbieten**: Soll die Seite mehrere Farbpaletten haben? (wie bei Doris' Webseite)
- Wenn ja: Mehrere Paletten als separate `farbpalette-*.html` erstellen und vergleichen
- Theme-Switcher oben auf der Seite einbauen (Button/Dropdown, wechselt CSS Custom Properties per JS)
- Jede Palette als eigenes `:root`-Set speichern (z.B. `[data-theme="graffiti"]`, `[data-theme="minimal"]`)
- Beispiel: `Jochen_webseite_v2/` hat 3 Paletten (Graffiti, JochenV2, J-Sphere)

#### Dark Mode / Light Mode

- **Im Briefing klären**: Nur Dark? Nur Light? Oder beides mit Toggle?
- Wenn Toggle: Dark + Light als eigene Paletten-Sets, `prefers-color-scheme` als Default, manueller Override per Button
- Dark ist unser Standard (Apple HIG), Light nur wenn es zur Marke passt

#### Farbpaletten-HTML Format

Exakt das Format von `farbpalette.html` in diesem Repo replizieren:
- Apple-HIG Minimal-Style, dunkler Hintergrund
- **Swatches**: 7 Farbkacheln (140x100px, border-radius 12px) mit Hex-Code + Label
- **Demo-Card**: Beispiel-Karte mit Tag, Headline, Text, Primary + Secondary Button — Text an die neue Marke anpassen (Name, Tagline, Beispieltext)
- **CSS-Block**: Syntax-highlighted `:root` Block zum Kopieren
- Variablen-Namen bleiben immer gleich (siehe Mapping unten)

#### CSS-Variable-Mapping (7 Rollen)

| Variable | Rolle | Ableitung aus Bild |
|----------|-------|---------------------|
| `--color-bg` | Dunkelster Hintergrund | Dunkelster dominanter Ton |
| `--color-primary` | Karten, Sections, Nav | Leicht heller als bg, gleiche Farbfamilie |
| `--color-secondary` | Sekundärtext, Borders | Mittlerer Ton, gedämpft |
| `--color-accent` | CTAs, Highlights, Hover | Stärkste/wärmste Farbe aus dem Bild |
| `--color-teal` | Links, Labels, Tags | Komplementär- oder Kontrastfarbe |
| `--color-warm` | Akzent-Option | Warmer Ton (Gold, Orange, Gelb) |
| `--color-light` | Text, helle Elemente | Hellster Ton, leicht warm/kalt je nach Palette |

### Schritt 3 — Projekt-Setup

- Neuen Ordner anlegen unter `/Users/joho21/Projekte/` oder bestehenden nutzen
- Template-Dateien kopieren aus diesem Repo: `src/`, `.eleventy.js`, `package.json`, `.gitignore`
- `git init` + GitHub-Repo erstellen (`gh repo create <name> --public --source=. --push`)
- `.env` mit `GEMINI_API_KEY` anlegen (Key aus bestehenden Projekten, **nie in Code/Git!**)
- `.gitignore` muss `.env` enthalten
- `i18n.json` anlegen/anpassen falls mehrsprachig (Sprachen, Nav-Labels, Home-Subtitle)
- `npm install`

### Schritt 4 — Branding & Bilder

- **Favicons** generieren (favicon.io oder eigenes Logo) — für Browser-Tabs + Homescreen-Icons
- **OG-Tags** in `base.njk` anpassen — Open Graph Meta Tags (`og:title`, `og:description`, `og:image`, `og:url`) für WhatsApp/Social-Sharing-Vorschau
- **Hero-Bilder** generieren via Gemini API (`gemini-2.5-flash-image`)
- **Social-Links** in `base.njk` anpassen (Instagram, etc.)

### Schritt 5 — Impressum & Datenschutz

Gesetzliche Pflicht für jede deutsche Website. Templates liegen in `src/impressum.md` und `src/datenschutz.md` mit Platzhaltern.

- **Impressum** (`impressum.md`): Platzhalter ausfüllen mit echten Daten
  - Name, Adresse, E-Mail (§ 5 TMG / § 5 DDG)
  - Verantwortlich für Inhalt (§ 55 Abs. 2 RStV / § 18 Abs. 2 MStV)
  - Optional: Virtual Office statt Privatadresse (Jochen fragen)
- **Datenschutz** (`datenschutz.md`): Platzhalter ausfüllen
  - Verantwortliche Stelle (Name, Adresse, E-Mail)
  - Hosting: statichost.eu (Schweden/Helsinki, keine Logs, keine IPs, Art. 6 Abs. 1 lit. f DSGVO)
  - CMS-Backend: Scaleway Functions (Frankreich, Paris/Amsterdam, EU)
  - Keine Cookies, kein Tracking, keine Analyse-Tools (solange das stimmt)
  - Rechte der Betroffenen (Auskunft, Berichtigung, Löschung)
  - Falls Kontaktformular, Newsletter, Analytics etc. dazukommen → Datenschutz erweitern!
- Beide Seiten im Footer verlinken (in `base.njk`)

### Schritt 6 — Content

- Seiten-Struktur festlegen (welche Seiten braucht die Marke?)
- Instagram-Scraping falls vorhanden:
  - Captions: `instaloader --no-videos --no-pictures <handle>` → `.txt`-Dateien
  - Fotos: `instaloader --no-videos --no-captions --no-metadata-json <handle>` → JPGs
  - Ton + Schlüsselzitate analysieren
- Content schreiben in allen Sprachen
- Bilder: Originalfotos, Instagram-Fotos, KI-generiert (Gemini)

### Schritt 7 — SEO

Erst machen wenn Content steht und Site live ist.

- **Technisches SEO** (in `base.njk`):
  - `<title>` pro Seite (max ~60 Zeichen)
  - `<meta name="description">` pro Seite (max ~155 Zeichen)
  - `<link rel="canonical">` auf jeder Seite
  - `<html lang="xx">` korrekt pro Sprache
  - `hreflang`-Tags für mehrsprachige Seiten (`<link rel="alternate" hreflang="de" href="...">`)
  - Semantisches HTML: ein `<h1>` pro Seite, logische Heading-Hierarchie
  - Bilder: `alt`-Texte, `width`/`height` Attribute, komprimierte Dateien
- **OG-Tags** (bereits in Schritt 4 angelegt, hier verifizieren):
  - `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
  - `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- **Strukturierte Daten** (JSON-LD in `base.njk`, optional):
  - `Person` oder `Organization` Schema
  - `WebSite` Schema mit `name` und `url`
- **sitemap.xml** — Eleventy-Plugin oder manuell
- **robots.txt** — `src/robots.txt` mit `Sitemap:` Verweis
- **Performance**: Bilder komprimieren (`sips --resampleWidth 1600`), kein unnötiges JS

### Schritt 8 — Domain

- **Gibt es schon eine Domain?**
  - Ja → Wo liegt sie? (Registrar: IONOS, Namecheap, GoDaddy, etc.)
  - Umzug nötig? DNS auf statichost.eu umstellen oder Domain transferieren
  - Wer hat Zugang zum Registrar-Account?
- **Neue Domain nötig?**
  - Domain-Ideen sammeln (Name, Varianten, TLDs)
  - **Verfügbarkeit prüfen**: Web-Suche nach WHOIS / Domain-Check
  - **Markencheck**: Bestehende Marken mit gleichem/ähnlichem Namen? (DPMA für DE, EUIPO für EU)
  - **Social-Media-Check**: Ist der Name als Handle auf Instagram/TikTok/YouTube frei?
  - TLD-Empfehlung: `.com` > `.de` > Rest (je nach Zielgruppe)
  - Registrar-Empfehlung: Namecheap oder Cloudflare (günstig, kein Upselling)
- **DNS-Setup**: statichost.eu Custom Domain oder Cloudflare DNS → statichost.eu

### Schritt 9 — Launch

- Build testen: `npx @11ty/eleventy`
- Mobile testen (Dev-Server auf `0.0.0.0`, im WLAN via IP erreichbar)
- statichost.eu-Site anlegen und mit GitHub-Repo verknüpfen (public Repo)
- perfectCMS: Scaleway Function deployen, Env-Vars pro Kunde setzen
- Domain verbinden (DNS aus Schritt 8)
- Git push → statichost.eu baut automatisch

---

## Techstack

- **SSG**: Eleventy 2.0.1 + Nunjucks
- **Hosting**: statichost.eu (Schweden, Server in Helsinki, EU, null Logs)
- **CMS** (optional): perfectCMS (eigenes Projekt, siehe `/Users/joho21/Projekte/perfectCMS/`)
- **Serverless Functions** (für perfectCMS): Scaleway Functions (Frankreich, Server in Paris/Amsterdam, EU)
- **Styling**: Plain CSS, Dark Theme, CSS Custom Properties
- **JS**: Vanilla JS (minimal)
- **Dev-Server**: Port 9495
- **Bildgenerierung**: Gemini API (`gemini-2.5-flash-image`), Key in `.env` als `GEMINI_API_KEY`

## Hosting: statichost.eu

- **Anbieter**: Variable Object Assignment, Stockholm, Schweden (gegr. 2022)
- **Server**: Helsinki, Finnland (EU)
- **DSGVO**: Keine personenbezogenen Daten, keine Logs, keine IPs, kein Cookie-Banner nötig
- **Free Tier**: 10 GB Bandwidth + 100 Build-Minuten/Monat
- **Überschreitung**: 1 EUR / 10 GB, 1 EUR / 100 Min (Pay-as-you-go)
- **Fallback-Hoster**: IONOS Deploy Now (Deutschland, ca. 2 EUR/Monat)

### statichost.eu Setup (getestet 28. Feb 2026)

- **Repos müssen public sein** — private Repos brauchen SSH (9€/Monat Starter Plan), das brauchen wir nicht
- Public Repos sind kein Problem: Website-Code ist eh öffentlich, Secrets liegen in `.env` (gitignored)
- **SSG-Typ**: "Node.js" wählen (kein eigener Eleventy-Eintrag)
- **Build Command**: `npx @11ty/eleventy`
- **Public Directory**: `_site`
- **Package Manager**: npm
- **Kein Auto-Webhook**: Nach `git push` muss man im Dashboard "Build now" klicken, ODER Webhook manuell einrichten
- **Build-Dauer**: ~18 Sekunden
- **Subdomain**: `<name>.statichost.page` (kostenlos), Custom Domain möglich
- **API-Key**: In `/Users/joho21/Projekte/website-template/.env` als `STATICHOST_API_KEY`
- **Test-Site**: https://jochen-test.statichost.page (Repo: s0f4surf3r/website-template)
- **Account**: joho21@web.de

## Serverless Functions: Scaleway (nur bei perfectCMS)

- **Anbieter**: Scaleway SAS, Paris, Frankreich
- **Server**: Paris + Amsterdam (EU)
- **Free Tier**: 1 Million Requests/Monat + 400.000 GB-Sekunden Compute
- **Überschreitung**: 0,15 EUR pro Million Requests
- **Nutzung**: Nur für perfectCMS Auth + API (Login, Speichern, Bildupload)
- **Typischer Verbrauch**: 50-100 Requests/Monat → 0,005% des Free Tiers
- Wird für jede Kunden-Website eingerichtet — jeder Kunde braucht CMS, weil er selbst Texte/Preise ändern können muss
- **Scaleway Account**: Registrierung gestartet (28. Feb 2026), Account-Typ: "Personal project"

### Kosten-Kalkulation für typische Kunden-Website

| Szenario | Bandwidth | Builds | Functions | Kosten |
|----------|-----------|--------|-----------|--------|
| Statische Seite, kein CMS | ~1 GB | ~3/Monat | 0 | **0 EUR** |
| 2.000 Besucher/Monat, kein CMS | ~5 GB | ~5/Monat | 0 | **0 EUR** |
| Blog, 3 Posts/Monat | ~3 GB | ~6/Monat | ~50 | **0 EUR** |
| Seite geht viral, 10.000 Besucher | ~15 GB | ~10/Monat | ~50 | **0,50 EUR** |
| Worst Case: richtig viel Traffic | ~50 GB | ~50/Monat | ~200 | **4 EUR** |

### Kunden-Wording (Copy-Paste für Gespräch/Angebot)

#### Variante A — Statische Seite (ohne CMS)

> "Deine Website kostet dich im laufenden Betrieb nichts — nur die Domain, das sind 10-15 Euro im Jahr. Das Hosting ist kostenlos solange deine Seite unter 10 GB Traffic im Monat bleibt, und das reicht für mehrere tausend Besucher. Falls du irgendwann so erfolgreich wirst dass es mehr wird — herzlichen Glückwunsch, dann kostet es 1 Euro pro weitere 10 GB. Keine Abo-Falle, kein Kleingedrucktes. Und deine Daten liegen in Europa, nicht in den USA."

#### Variante B — Mit Blog/CMS

> "Deine Website kostet dich im laufenden Betrieb nichts — nur die Domain, das sind 10-15 Euro im Jahr. Deine Seite läuft auf zwei europäischen Diensten: Einer in Schweden liefert deine Website aus, einer in Frankreich ermöglicht dir das Schreiben und Veröffentlichen. Beide sind kostenlos für die Größe deiner Seite — und werden es auch bleiben, selbst wenn du jeden Tag einen Blogpost schreibst. Erst bei zehntausenden Besuchern im Monat fallen ein paar Euro an. Keine Abo-Falle, kein Kleingedrucktes. Und das Wichtigste: Deine Daten liegen komplett in der EU — Schweden und Frankreich, keine amerikanischen Server."

## Deploy-Regel

- Deployen ist OK wenn kostenlos — einfach machen, aber transparent sagen was passiert
- Bevorzugt: Git push → statichost.eu baut automatisch
- **NIEMALS** deployen ohne vorheriges Git-Setup

## Template-Dateien

| Datei/Ordner | Zweck |
|---|---|
| `src/_layouts/base.njk` | HTML-Gerüst, OG-Tags, Favicons, Nav |
| `src/_layouts/page.njk` | Inhaltsseiten (wraps in `<article class="content">`) |
| `src/css/style.css` | CSS mit Custom Properties |
| `src/index.njk` | Startseite |
| `src/images/` | Bilder |
| `.eleventy.js` | Eleventy-Konfiguration |
| `src/impressum.md` | Impressum-Template mit Platzhaltern |
| `src/datenschutz.md` | Datenschutz-Template mit Platzhaltern |
| `farbpalette.html` | Referenz-Format für Farbpaletten-HTML |

## Testumgebung

- **`/Users/joho21/Projekte/Jochen_webseite_v2/`** — Spielwiese zum Ausprobieren (Eleventy + Git, hat schon 3 Farbpaletten)
- Hier neue Features testen (perfectCMS, Theme-Switcher, etc.) bevor sie ins Template oder Live-Projekte wandern
- Nicht für Produktion — nur zum Experimentieren
