# BULROG — site vitrine (démonstration)

Site statique d’une manufacture horlogère fictive de la Vallée de Joux. HTML/CSS/JS vanilla, aucune étape de build, aucune dépendance : tout le visuel (calibre BR-01, rouage, échappement, finitions, montres) est dessiné en SVG / canvas.

**Ouvrir le site :** double-cliquez sur `index.html`, ou servez le dossier (`npx http-server . -p 8080` puis http://localhost:8080). Tous les chemins sont relatifs : le dossier fonctionne tel quel sous un sous-chemin GitHub Pages.

Structure : `index.html` (toutes les sections inlinées) · `css/` (base + une feuille par section) · `js/gears.js` (géométrie et horloge partagées), `js/main.js` (navigation), un script par section.

Ce qui suit est la spécification d’origine (les mentions de `partials/` sont historiques : les fragments sont désormais intégrés à `index.html`).

---

# BULROG — Spécification du site (source de vérité)

Site statique (HTML/CSS/JS vanilla, aucun build, aucune dépendance npm, aucune image externe).
Tout le visuel est **procédural** : SVG inline et/ou `<canvas>`. Seules ressources externes autorisées : Google Fonts (déjà liées dans `index.html`).
Le site est servi par GitHub Pages **sous un sous-chemin** → tous les chemins sont **relatifs** (`css/x.css`, jamais `/css/x.css`).
Ne jamais toucher à quoi que ce soit en dehors de `/home/user/Cochonsinde/bulrog/`. Pas de commit git.

Brief client : *« Du détail de la précision, une vue sur le cœur de l’horlogerie : les mécanismes doivent être mis en avant. »*
→ Le **mouvement mécanique** (calibre, rouage, échappement, balancier-spiral, barillet, rubis, masse oscillante) est le héros de chaque section.

---

## 1. La marque (faits à utiliser **mot pour mot** partout)

| Élément | Valeur |
|---|---|
| Nom | **BULROG** (toujours en capitales dans le logo / titres de marque ; « Bulrog » accepté dans le texte courant) |
| Statut | Manufacture horlogère — Swiss made |
| Siège / atelier | Le Sentier, Vallée de Joux, Suisse |
| Signature (tagline) | **« La précision a un cœur. »** |
| Sous-signature | « Haute horlogerie de la Vallée de Joux, mise à nu. » |
| Fondation de la marque | Atelier rouvert en **2019** ; marque lancée en **2026** |
| Fondatrice | **Mathilde Bulrog**, horlogère, arrière-arrière-petite-fille du cabinotier fondateur |
| Ancêtre | **Abram-Louis Bulrog**, cabinotier au Sentier (1874) |

### Chronologie (section « La manufacture »)
- **1874** — Abram-Louis Bulrog, cabinotier au Sentier, livre ses premières ébauches aux maisons genevoises.
- **1921** — L’atelier familial signe un chronomètre de poche primé lors d’un concours de chronométrie.
- **1976** — La crise du quartz ferme l’atelier. Les établis et les outils sont conservés, intacts.
- **2019** — Mathilde Bulrog rouvre l’atelier du Sentier avec six horlogers.
- **2023** — Naissance du **Calibre BR-01**, après quatre années de développement.
- **2026** — Lancement de BULROG et de sa première collection.

### Savoir-faire en chiffres
- **14** artisans horlogers
- **214** composants par mouvement
- **62 heures** de finition manuelle par mouvement
- **21 jours** de contrôle chronométrique, en **5 positions**
- **480** montres par an, au maximum

### Calibre maison — **Calibre BR-01**
| Spécification | Valeur (texte exact) |
|---|---|
| Type | Mouvement mécanique à remontage automatique, manufacture |
| Diamètre | 30,4 mm (13 ½ lignes) |
| Épaisseur | 5,6 mm |
| Fréquence | **28 800 alt/h (4 Hz)** — 8 alternances par seconde |
| Rubis | **31 rubis** |
| Composants | **214 composants** |
| Réserve de marche | **72 heures** (barillet unique) |
| Précision | **−2 / +4 s/jour** |
| Amplitude | ≈ 285° (angle de levée 52°) |
| Échappement | Ancre suisse ; roue d’échappement 15 dents à dents « club » ; ancre à deux levées en rubis |
| Organe réglant | Balancier à inertie variable, 4 masselottes en or ; spiral à courbe terminale Breguet |
| Masse oscillante | Or rose 22 carats, décor côtes de Genève, remontage bidirectionnel |
| Fonctions | Heures, minutes, secondes au centre |
| Finitions | Côtes de Genève sur les ponts, perlage sur la platine, anglage main poli (angles rentrants), vis bleuies à la flamme, rubis sertis en chatons d’or |
| Variante | **Calibre BR-01S** : version squelettée (modèle Ossature 42) |

**Rouage (rapports exacts — déjà codés dans `BulrogGears.CALIBRE`)**

| Mobile | Dents / pignon | Vitesse |
|---|---|---|
| Barillet | 80 dents | 1 tour / 8 h |
| Roue de centre | 80 dents / pignon 10 | 1 tour / h (aiguille des minutes) |
| Roue moyenne | 75 dents / pignon 10 | 1 tour / 7 min 30 s |
| Roue de secondes | 96 dents / pignon 10 | 1 tour / 60 s |
| Roue d’échappement | 15 dents / pignon 6 | 1 tour / 3,75 s (16 tr/min), avance de 12° à chaque alternance |
| Balancier | — | 4 oscillations / s (8 alternances / s) |

**Sous-ensembles (pour l’explorateur « Au cœur du mouvement »)**

| # | Sous-ensemble | Composants | Matériaux | Finition | Rôle (résumé) |
|---|---|---|---|---|---|
| 1 | Barillet & ressort | 12 | Ressort en alliage cobalt-nickel, tambour en acier | Colimaçonnage du rochet | Stocke l’énergie : 72 heures de réserve |
| 2 | Rouage | 18 | Roues en laiton doré, pignons en acier trempé poli | Roues soleillées, pignons polis | Transmet et démultiplie l’énergie jusqu’à l’échappement |
| 3 | Échappement à ancre suisse | 11 | Acier trempé, rubis synthétiques | Ancre anglée et polie | Libère l’énergie par impulsions régulières : 8 fois par seconde |
| 4 | Balancier-spiral | 16 | Balancier cuivre-béryllium, masselottes en or, spiral en alliage auto-compensateur | Spiral Breguet mis en forme à la main | Le cœur qui bat : 28 800 alternances par heure |
| 5 | Ponts & platine | 38 | Maillechort rhodié | Côtes de Genève, perlage, anglage | Architecture qui porte les 31 rubis |
| 6 | Masse oscillante | 34 | Or rose 22 carats, roulement à billes céramique | Côtes de Genève, gravure | Remonte le ressort à chaque mouvement du poignet |

### La collection (3 modèles)
| Modèle | Réf. | Boîtier | Diamètre / épaisseur | Cadran | Aiguilles | Étanchéité | Bracelet | Prix |
|---|---|---|---|---|---|---|---|---|
| **Joux 40** | BR-J40-AC | Acier 316L poli et satiné | 40 mm / 10,4 mm | Noir ardoise, décor soleillé, index appliqués or | Dauphine dorées | 50 m | Alligator noir, boucle ardillon acier | **CHF 14 800** |
| **Risoud 41** | BR-R41-OR | Or rose 18 carats 5N | 41 mm / 10,9 mm | Émail grand feu bleu nuit, minuterie chemin de fer | Feuille en or rose | 50 m | Alligator brun, boucle déployante or | **CHF 34 500** |
| **Ossature 42** | BR-O42-TI | Titane grade 5 microbillé | 42 mm / 11,2 mm | Squelette (Calibre BR-01S), réhaut noir, index appliqués rhodiés | Bâton squelettées, pointes luminescentes | 30 m | Caoutchouc noir, boucle titane | **CHF 58 000** — série limitée de **88 exemplaires** |

Tous : Calibre BR-01 (Ossature : BR-01S), glace et fond saphir traités antireflet, couronne gravée du monogramme « B ».
Format prix : `CHF 14 800` (espace fine insécable `&#8239;` entre les milliers). Mention « Prix indicatifs TTC en Suisse ».

### Rendez-vous / légal
- Salon de l’atelier : **Grand-Rue 12, 1347 Le Sentier, Suisse** — visites sur rendez-vous, du mardi au samedi.
- **Ne publier aucun numéro de téléphone ni e-mail** (marque fictive). Le formulaire est la seule prise de contact.
- Footer : `© <span data-year></span> BULROG Manufacture horlogère — Le Sentier, Vallée de Joux. Swiss made.` + ligne discrète « Marque fictive — site de démonstration. » + liens Mentions légales / Confidentialité (ancres `#`).

### Ton & typographie française
- Registre : élégant, précis, sobre ; phrases courtes ; vouvoiement.
- Espace insécable **avant** `: ; ! ?` et à l’intérieur des guillemets `« … »` → utilisez `&nbsp;` (ou `&#8239;`).
- Nombres : `28 800` avec `&#8239;` ; décimales avec virgule (`30,4 mm`) ; unités précédées d’une espace insécable.
- Apostrophe typographique `’`.

---

## 2. Design system (`css/base.css` — propriété de l’architecte, ne pas modifier)

**Polices** (déjà chargées) : `--font-display` Cormorant Garamond (300–600 + italiques) · `--font-sans` Manrope (300–700) · `--font-mono` JetBrains Mono (chiffres, specs, instruments).

**Couleurs** — n’utilisez que les tokens :
`--c-bg #0a0908` · `--c-bg-2` · `--c-surface` · `--c-surface-2` · `--c-line` · `--c-line-strong` ·
`--c-gold #c9a45c` · `--c-gold-light` · `--c-gold-deep` · `--c-brass` ·
`--c-steel` · `--c-steel-light` · `--c-steel-dark` ·
`--c-blue #2d4fb3` (vis bleuies) · `--c-blue-light` · `--c-blue-deep` ·
`--c-ruby #b3122e` · `--c-ruby-light` ·
`--c-text` · `--c-text-muted` · `--c-text-dim` · `--c-success` · `--c-error`.
Dégradés CSS : `--grad-gold`, `--grad-steel`, `--grad-blued`, `--grad-ruby`.

**Échelle typo** : `--fs-xs … --fs-3xl` (clamp). `h1` = `--fs-3xl` (un seul `h1`, dans le hero), `h2` = `--fs-2xl`.
**Espacement** : `--sp-1 … --sp-10`, `--section-pad`, `--gutter` (16 px à 375 px).
**Layout** : `.container` (1240 px), `.container--narrow` (820), `.container--wide` (1560). `--header-h` 72 px / `--header-h-small` 58 px.
**Mouvement** : `--ease-out`, `--ease-in-out`, `--dur-1/2/3`, `--dur-reveal`.
**z-index** : header 100, menu 110, overlay 200 → vos sections restent **< 100**.

**Classes utilitaires partagées** (à réutiliser, ne pas redéfinir) :
- `.section` (+ `.section--alt` fond alterné) — padding vertical standard.
- En-tête de section :
  ```html
  <header class="section-head">            <!-- ou .section-head.section-head--center -->
    <p class="section-eyebrow"><span class="section-num">02</span> Au cœur du mouvement</p>
    <h2 class="section-title" id="coeur-title">Le calibre <em>mis à nu</em></h2>
    <p class="section-lead">…</p>
  </header>
  ```
  Numérotation : 01 hero (pas d’eyebrow requis) · 02 coeur · 03 precision · 04 finitions · 05 collection · 06 manufacture · 07 rendez-vous.
- Boutons : `.btn`, `.btn--primary` (or), `.btn--ghost`, `.btn--sm`, flèche `<span class="btn-arrow" aria-hidden="true">→</span>`.
- `.link`, `.chip`, `.dot` / `.dot--ruby` / `.dot--blue`, `.rule` (filet doré), `.lead`.
- Specs : `<dl class="spec-list"><div><dt>Fréquence</dt><dd>28 800 alt/h</dd></div>…</dl>`.
- Texte : `.t-caps`, `.t-mono` / `.num` (chiffres tabulaires), `.t-muted`, `.t-gold`, `.gold-text`, `.visually-hidden`.
- Apparition au scroll : ajoutez `.reveal` (option `.reveal--fade`, `.reveal--scale`, délai `style="--reveal-delay:120ms"`). `main.js` ajoute `.is-visible`. Pour du contenu injecté après coup : `window.Bulrog.observeReveal(rootEl)`.

---

## 3. Structure & intégration

```
bulrog/
  index.html            (architecte) head, header/nav, placeholders, scripts
  SPEC.md               (architecte)
  css/base.css          (architecte)
  js/gears.js           (architecte) bibliothèque partagée window.BulrogGears
  js/main.js            (architecte) nav, menu mobile, header, reveal, window.Bulrog
  partials/hero.html        css/hero.css        js/hero.js         → builder A
  partials/coeur.html       css/coeur.css       js/coeur.js        → builder B
  partials/precision.html   css/precision.css   js/precision.js    → builder C
  partials/collection.html  css/collection.css  js/collection.js   → builder D
  partials/footer.html                                             → builder D
```

`index.html` contient, dans `<main id="main">`, les lignes exactes
`<!-- PARTIAL:hero -->`, `<!-- PARTIAL:coeur -->`, `<!-- PARTIAL:precision -->`, `<!-- PARTIAL:collection -->`
et après `</main>` : `<!-- PARTIAL:footer -->`.
L’intégrateur remplace chaque ligne par le contenu de `partials/<nom>.html`. **Un partial = uniquement des éléments de section** (pas de `<html>`, `<head>`, `<script>`, `<link>`, `<style>`).

Ordre de chargement des scripts (tous `defer`) : `gears.js` → `main.js` → `hero.js` → `coeur.js` → `precision.js` → `collection.js`.
Le DOM des partials existe donc au moment où votre script s’exécute.

**Tester avant intégration** : serveur de dev qui assemble les partials à la volée :
`node /tmp/claude-0/-home-user-Cochonsinde/b7bc187b-d5ca-5aa9-9caf-e25ea0d048fc/scratchpad/bulrog/serve.js <port-unique>` → `http://localhost:<port>/`
(les fichiers de `scratchpad/bulrog/` sont servis sous `/__scratch/`). Playwright : `NODE_PATH=/opt/node22/lib/node_modules`, `require('playwright')`, `chromium.launch()`, contexte avec `ignoreHTTPSErrors: true` pour que Google Fonts charge via le proxy. Scripts et captures dans `scratchpad/bulrog/<votre-nom>/`, **jamais** dans le repo. Tuez vos serveurs.

---

## 4. Règles communes à tous les builders

1. **Propriété** : ne modifiez que vos fichiers. Besoin d’un changement dans base.css / gears.js / main.js / index.html → signalez-le dans votre rapport final, ne l’éditez pas.
2. **Préfixes** : toute classe, tout `id`, toute `@keyframes`, toute custom property locale et tout id SVG (`<linearGradient id>`, `<clipPath id>`, `<pattern id>`…) commence par votre préfixe : `hero-` · `coeur-` · `prec-` · `coll-`. Sélecteurs CSS scopés sous votre section (`.coeur …` / `#coeur …`) ; jamais de sélecteur d’élément nu global (`svg {}`, `button {}`, `h3 {}`).
   Exceptions autorisées : les classes partagées listées §2, et les ids de section imposés §5.
3. **JS** : un IIFE `(function(){ 'use strict'; … })();`, aucune variable globale (sauf éventuellement `window.BulrogHero` / `BulrogCoeur` / `BulrogPrecision` / `BulrogCollection` si utile au debug). Sortir proprement si la section est absente (`if (!root) return;`). Requêtes DOM scopées à votre section.
4. **Animation** : exclusivement via `BulrogGears.ticker.add(fn, { el: <votre svg/canvas/section> })` — jamais de `requestAnimationFrame` libre ni de `setInterval` d’animation. Le ticker gère : onglet caché, hors écran (IntersectionObserver) et `prefers-reduced-motion`. Par défaut en mouvement réduit : **une image fixe** (fn appelé une fois avec `dt=0`). Horloges : `{ reduced: 1 }` (mise à jour 1×/s). Transitions CSS : déjà neutralisées par base.css en mouvement réduit.
   Mise à jour par frame : ne modifiez que des `transform`/attributs, pas de reconstruction de DOM. Canvas : `devicePixelRatio` plafonné à 2, redimensionnement via `ResizeObserver`.
5. **Mécanique fidèle** : utilisez `BulrogGears.escapement(t)` et `BulrogGears.train(state)` pour que le balancier (4 Hz), l’ancre, la roue d’échappement (12°/alternance) et le rouage aient **les mêmes cinématiques dans tout le site**. Heure réelle : `BulrogGears.hands()` (trotteuse en 8 pas/s).
6. **Responsive** : aucun défilement horizontal de 375 à 1920 px (testez `document.documentElement.scrollWidth === innerWidth`). SVG en `viewBox` + `width:100%`. Cibles tactiles ≥ 44 px.
7. **Accessibilité** : SVG décoratifs `aria-hidden="true" focusable="false"` ; SVG porteurs de sens `role="img"` + `<title>`/`aria-label` en français. Contrôles = vrais `<button>` avec `aria-pressed` / `aria-expanded` / `aria-controls` ; libellés français. Info dynamique importante → `aria-live="polite"`. Focus visible (déjà global). Hiérarchie : un seul `h1` (hero), puis `h2` par section, `h3` en dessous. Contraste ≥ 4.5:1 pour le texte courant.
8. **Pas de réseau** : aucun `fetch`, aucune image, aucune police hors Google Fonts, aucune librairie externe.
9. Commentez brièvement vos fichiers (en-tête : rôle, propriétaire).

---

## 5. Sections & propriété

### A — Hero · builder A
- Fichiers : `partials/hero.html`, `css/hero.css`, `js/hero.js` · préfixe **`hero-`**
- Racine : `<section id="hero" class="hero" aria-label="BULROG — La précision a un cœur">`
- Plein écran (`min-height: 100svh`, repli `100vh`) ; le header fixe transparent se superpose → réserver `padding-top: var(--header-h)`.
- Visuel : grand calibre **BR-01 vivant** vu côté fond saphir / en squelette (SVG, `viewBox` carré, centré ou décalé à droite sur desktop, derrière/au-dessus du texte sur mobile) :
  platine perlée, ponts côtes de Genève (`#bg-cotes`, `#bg-perlage`, `#bg-rhodium`), vis bleuies (`BulrogGears.screw`), rubis en chatons (`BulrogGears.jewel`),
  barillet, roue de centre, roue moyenne, roue de secondes, roue d’échappement **aux rapports exacts** (`train()`), ancre qui bascule, **balancier à 4 Hz** avec spiral qui respire (`hairspringPath({ twist })`), aiguilles à l’**heure réelle** (heures, minutes, trotteuse centrale 8 pas/s).
  Option élégante : masse oscillante qui pivote lentement / s’écarte au scroll pour révéler le mouvement.
- Texte : eyebrow `Manufacture horlogère · Vallée de Joux`, `<h1>` « BULROG » (wordmark, lettres espacées), tagline « La précision a un cœur. », sous-signature, CTA `.btn--primary` « Découvrir le calibre » → `#coeur`, `.btn--ghost` « La collection » → `#collection`. Petits repères chiffrés (`28 800 alt/h · 31 rubis · 72 h`). Indicateur de scroll.
- Mouvement réduit : image fixe du calibre à l’heure courante (`reduced: 1` acceptable pour les aiguilles uniquement).

### B — Au cœur du mouvement · builder B (**pièce maîtresse**)
- Fichiers : `partials/coeur.html`, `css/coeur.css`, `js/coeur.js` · préfixe **`coeur-`**
- Racine : `<section id="coeur" class="section coeur" aria-labelledby="coeur-title">` · eyebrow `02`
- Titre suggéré : « Au cœur du mouvement » / « Le calibre <em>mis à nu</em> ».
- **Vue éclatée / explorateur de couches** du Calibre BR-01 : les 6 sous-ensembles du §1 (barillet → rouage → échappement → balancier-spiral → ponts & platine → masse oscillante), en SVG, pilotée au scroll (sticky) **et** au clic (liste de boutons / onglets accessibles au clavier). Couches qui s’écartent en perspective (CSS 3D ou décalage isométrique), couche active mise en lumière, autres atténuées.
  Hotspots annotés (points pulsants → bulle) ; pour chaque composant : rôle, nombre de composants, matériau, finition (**valeurs du tableau §1**).
- **Loupe d’échappement** : grand zoom de l’ancre suisse (`escapeWheel`, `escapementLayout`, `palletStonePath`, `balanceWheel`, `escapement(t)`), cycle **dégagement → impulsion → chute → repos** expliqué pas à pas avec libellé de phase (`state.phaseLabel`, en `aria-live`), boutons Lecture/Pause, vitesse (Temps réel ×1, ralenti ×0,1, ×0,02) via `handle.speed`, pas-à-pas (image par image). En mouvement réduit : pause par défaut, pas-à-pas disponible.
- Sur mobile : l’explorateur devient une pile verticale / carrousel ; pas de sticky piégeant le scroll.

### C — La précision + Les finitions · builder C
- Fichiers : `partials/precision.html`, `css/precision.css`, `js/precision.js` · préfixe **`prec-`**
- Racines : `<section id="precision" class="section prec" aria-labelledby="prec-title">` (eyebrow `03`) **puis** `<section id="finitions" class="section section--alt prec-finitions" aria-labelledby="prec-fin-title">` (eyebrow `04`) — les deux dans `partials/precision.html`.
- Précision : chiffres chronométriques à compteurs animés (déclenchés à l’apparition, valeurs finales dans le HTML pour sans-JS/mouvement réduit) : `28 800 alt/h`, `8 alternances/s`, `−2/+4 s/jour`, `72 h`, `31 rubis`, `214 composants`, `21 jours / 5 positions`.
  Visualisation **8 battements/s vs pas de quartz 1/s** (deux trotteuses ou deux barres côte à côte, calées sur `hands()`/`escapement`).
  **Trace de timegrapher** façon Witschi sur `<canvas>` : points défilants pour chaque battement (tic/tac en deux lignes), marche affichée `+2 s/j`, amplitude `285°`, écart de repère `0,2 ms`, angle de levée `52°`, avec sélecteur de position (CH, CB, 6H, 9H, 3H) qui modifie légèrement la pente/l’amplitude.
- Finitions : côtes de Genève, perlage, anglage, vis bleuies (à la flamme ≈ 290 °C, couleur « bleu roi »), polissage « poli miroir » ; chaque technique = carte avec échantillon **procédural** (SVG pattern ou canvas) + **loupe au survol / au toucher** (cercle grossi qui suit le pointeur, focus clavier = loupe centrée). Texte : geste, outil, temps passé.

### D — La collection + La manufacture + Rendez-vous + footer · builder D
- Fichiers : `partials/collection.html`, `partials/footer.html`, `css/collection.css`, `js/collection.js` · préfixe **`coll-`**
- Racines (toutes dans `partials/collection.html`, dans cet ordre) :
  `<section id="collection" class="section coll" aria-labelledby="coll-title">` (eyebrow `05`) ·
  `<section id="manufacture" class="section section--alt coll-manufacture" aria-labelledby="coll-manu-title">` (eyebrow `06`) ·
  `<section id="rendez-vous" class="section coll-rdv" aria-labelledby="coll-rdv-title">` (eyebrow `07`).
  `partials/footer.html` : `<footer class="coll-footer">…</footer>`.
- Collection : les **3 modèles du §1**, chacun en SVG détaillé : boîte, cornes, couronne cannelée, lunette, cadran avec index et minuterie, aiguilles à l’**heure réelle** (`hands()`, ticker `reduced: 1`) ; Ossature 42 **squelette** laissant voir le rouage animé. Fiche technique en `.spec-list`, prix, référence, bouton « Prendre rendez-vous » → `#rendez-vous` (pré-sélectionne le modèle dans le formulaire). Sélecteur de modèle (onglets accessibles) ou grille de 3 cartes.
- Manufacture : chronologie §1 (frise verticale sur mobile, horizontale/alternée sur desktop) + « Savoir-faire en chiffres » §1.
- Rendez-vous : formulaire accessible (labels, `autocomplete`, validation côté client, messages d’erreur liés via `aria-describedby`, message de succès `role="status"`) : civilité, nom, e-mail, téléphone (optionnel), modèle (select : Joux 40, Risoud 41, Ossature 42, Visite de l’atelier), lieu (Salon de l’atelier — Le Sentier / Visio-conférence), date souhaitée, message, consentement. **Aucun envoi réseau** (`preventDefault`). Adresse du salon §1.
- Footer : monogramme, « Swiss made », liens internes, mentions §1.

---

## 6. `window.BulrogGears` — API (js/gears.js)

Conventions : SVG, +y vers le bas, **angle positif = sens horaire**, angle 0 = 3 h, −π/2 = 12 h. Fonctions géométriques en **radians** ; cinématique en **degrés**. Les chemins avec trous → `fill-rule="evenodd"`.

| Fonction | Retour / usage |
|---|---|
| `gear({ teeth, radius \| module, profile?, phase?, cx?, cy?, spokes?, curve?, spokeWidth?, rimWidth?, hubRadius?, hole? })` | `{ d, pitchRadius, outerRadius, rootRadius, module, teeth }`. `profile` : `'involute'` (défaut ≥ 15 dents), `'watch'` (ogival horloger), `'leaf'` (pignon, défaut ≤ 14). `spokes` défaut 5, `curve` = torsion des bras (0,3–0,6 élégant). |
| `pinion({ teeth, radius, hole })` | pignon plein, profil `leaf`. |
| `teethPath(o)`, `windowsPath({ rim, hub, spokes, width, curve, phase })` | briques bas niveau. |
| `escapeWheel({ radius, teeth=15, root=.74, club=.075, spokes=4, curve=.35, hole })` | roue d’échappement à dents club, dents orientées sens horaire (tourne en `rotate(+)`). Dent 0 pointe à l’angle `phase`. |
| `escapementLayout(R)` | géométrie ancre suisse dans le repère roue d’échappement (centre 0,0) : `{ escape, pallet:{x,y}, balance:{x,y}, stones:[…], forkD, rollerRadius, pinRadius, swingDeg, liftDeg }`. Dessin : `<g transform="translate(pallet.x pallet.y) rotate(palletDeg)">` + `forkD` + `palletStonePath(stone)` ; balancier à `balance`, ellipse (rubis) à `(0, rollerRadius)` dans le repère du balancier. À `escapeDeg = 0` une dent est verrouillée sur la levée d’entrée. |
| `balanceWheel({ radius, rim?, arms=3, weights?, hole? })` | `{ d, weights:[{x,y,angle}] }` (serge + bras ; placer masselottes/vis sur `weights`). |
| `hairspringPath({ inner, outer, turns=12, twist, phase?, breguet? })` | `d` à tracer (stroke). `twist` = rotation actuelle du balancier (rad) → le spiral respire (virole tourne, piton fixe). |
| `circlePath(r,cx,cy)`, `ringPath(ro,ri)`, `polar(r,a,cx,cy)` | utilitaires. |
| `meshRotation(nA, nB, theta, rotA)` | rotation (rad) à donner à la roue B pour engrener avec A ; entraxe = `pitchRadiusA + pitchRadiusB`, `theta` = direction A→B. |
| `CALIBRE` | constantes BR-01 (4 Hz, 285°, levée 52°, rouage §1). |
| `escapement(t, { amplitudeDeg?, swingDeg? })` | `{ balanceDeg, palletDeg, escapeDeg, beats, phase, phaseLabel, progress, direction }` — `phase` ∈ `repos / degagement / impulsion / chute`. À vitesse réelle l’impulsion dure ≈ 4 ms : utilisez `handle.speed` (ralenti) pour la rendre visible. |
| `train(stateOrTime)` | angles **en degrés** signés : `{ escape, fourth, third, centre, barrel }` (roues engrenées de sens opposés). `fourth` = 1 tr/min, `centre` = 1 tr/h. |
| `hands(date?)` | `{ hour, minute, second }` en degrés (0 = midi), trotteuse en 8 pas/s. |
| `el(tag, attrs, children)` | création d’élément SVG. |
| `screw({ x, y, r, slot })` · `jewel({ x, y, r, hole, chaton })` | `<g>` vis bleuie fendue · rubis en chaton d’or. |
| `ensureDefs()` | (appelé par main.js) SVG caché avec : gradients `#bg-gold`, `#bg-gold-radial`, `#bg-brass`, `#bg-steel`, `#bg-steel-radial`, `#bg-rhodium`, `#bg-blued`, `#bg-ruby` ; motifs `#bg-cotes` (période 24 u), `#bg-perlage` (cellule 12 u) ; filtres `#bg-shadow`, `#bg-glow`. Les motifs sont en `userSpaceOnUse` : pour une autre échelle, créez votre propre motif préfixé. |
| `ticker.add(fn, { el, fps?, reduced?, speed?, time?, autoplay? })` | `fn({ time, dt, now, reduced, handle })`. `time` = horloge propre du sujet (s), avance seulement quand il joue, × `speed`. Retourne `handle` : `play() pause() toggle() remove() renderOnce()`, `speed`, `time` (lecture/écriture), `playing`. `reduced`: `'static'` (défaut) · `'run'` · nombre de fps. |
| `reducedMotion` (getter), `onReducedMotionChange(cb)` | état `prefers-reduced-motion`. |
| `util.{ clamp, lerp, easeInOut, easeOut, round }` | maths. |

Exemple minimal :
```js
const G = window.BulrogGears, E = G.el;
const svg = root.querySelector('.coeur-loupe-svg');
const L = G.escapementLayout(100);
const wheel = E('path', { d: G.escapeWheel({ radius: 100, hole: 4 }).d, fill: 'url(#bg-steel)', 'fill-rule': 'evenodd' });
svg.appendChild(wheel);
const h = G.ticker.add(({ time }) => {
  const s = G.escapement(time);
  wheel.setAttribute('transform', `rotate(${s.escapeDeg})`);
}, { el: svg });
h.speed = 0.05; // ralenti ×0,05
```

---

## 7. Checklist de livraison (chaque builder)
- [ ] Aucun défilement horizontal à 375, 768, 1440, 1920 px ; captures à 1440 et 375.
- [ ] Aucune erreur console ; aucune requête réseau hors Google Fonts.
- [ ] `prefers-reduced-motion: reduce` → image fixe lisible, rien ne clignote.
- [ ] Animations en pause hors écran / onglet caché (ticker avec `el`).
- [ ] Navigation clavier complète, focus visible, libellés français.
- [ ] Chiffres et noms identiques au §1.
- [ ] Rapport final : fichiers modifiés + demandes éventuelles à l’architecte.
