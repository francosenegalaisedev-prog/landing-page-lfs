# La Franco-Sénégalaise — site vitrine (Astro + Tailwind CSS)

Ce code reproduit la maquette validée (« Landing page V3 · synthèse ») : ouverture au soleil levant, bandeau des filiales, le phygital (avec l'animation de fusion du physique et du digital), notre conviction, le groupe (engagements, valeurs, mot du président), nos filiales et notre écosystème, nos expertises en onglets et notre méthode, carrières, contact et newsletter.

## Pile

- **Astro 7** : pages statiques, TypeScript, sans framework JavaScript côté navigateur.
- **Tailwind CSS 4**, branché par le plugin Vite officiel (`@tailwindcss/vite`).
- Quelques scripts TypeScript légers pour les interactions (`src/scripts/`).
- Hébergement prévu : **Vercel** ; formulaires : **Vercel Functions** (`api/`), **Brevo** pour les e-mails, **Cloudflare Turnstile** (facultatif) contre le spam.
- **Node.js 22.23.4 ou plus récent** (22.x sur Vercel ; exigence d'Astro 7).

## Démarrer

```sh
npm install
npm run dev       # http://localhost:4321 (exécute aussi /api/* si .env.local est rempli)
npm run build     # site statique dans dist/
npm run preview   # sert dist/ en local
npm run check     # vérification TypeScript des composants
npm test          # tests unitaires des fonctions /api/contact et /api/newsletter (sans clé)
```

## Où modifier quoi

| Fichier | Contenu |
| --- | --- |
| `src/config.ts` | Coordonnées, lien du site Support Connecté, informations légales, titre et description pour les moteurs de recherche, **interrupteur de la newsletter** (`fonctionnalites.newsletter`) |
| `src/data/poles.ts` | Les quatre pôles d'expertises : titres, textes, services |
| `src/data/marques.ts` | Filiales du bandeau défilant |
| `src/data/contact.ts` | Objets du formulaire de contact |
| `src/components/Conviction.astro` | Section « Notre conviction » et chaîne des 4 points de contact |
| `src/components/Groupe.astro` | Section « Le groupe » : engagements, valeurs, mot du président |
| `src/components/Projets.astro` | Section « Nos filiales » (YÉEG, Support Connecté, Nëkk, Teranga Immobilier, Musée de la mémoire) |
| `src/components/Poles.astro` | Section « Nos expertises » (4 onglets) et « Notre méthode » |
| `src/components/Phygital.astro` | Section « Le phygital » et animation de rencontre Physique / Digital |
| `src/components/Carrieres.astro` | Bandeau « Carrières » |
| `src/styles/global.css` | Charte en `@theme` Tailwind (couleurs, polices), utilitaires du site, soleil et animation phygital |
| `src/assets/` | Logos (PNG et WebP) |
| `public/` | Favicon, icône d'écran d'accueil, image de partage `og-image.jpg` |
| `api/contact.ts`, `api/newsletter.ts`, `lib/brevo.ts` | Fonctions Vercel d'envoi (Brevo) et journaux d'erreur |
| `.env.local.example` | Modèle des variables des fonctions, pour les tester en local |
| `tests/fonctions.test.mjs` | Tests unitaires des fonctions avec une API Brevo simulée |

Composants (`src/components/`) : `EnTete`, `Ouverture`, `BandeauMarques`, `Phygital`, `Conviction`, `Groupe`, `Projets`, `CarteProjet`, `PastillesPoles`, `Poles`, `Carrieres`, `Contact`, `PiedDePage`, `Icone`, `PageSimple`.
Pages (`src/pages/`) : `index.astro`, `mentions-legales.astro`, `confidentialite.astro`, `robots.txt.ts`, `sitemap.xml.ts`.

## Charte dans Tailwind

- Couleurs : `noir`, `creme`, `ambre`, `ambre-fonce`, `miel`, `sable`, `bronze` ; sur fond sombre `texte-2` à `texte-4`, `trait-1` à `trait-4`, `surface-1` à `surface-3` ; sur fond clair `encre-2` à `encre-4`, `trait-clair`, `champ`.
- Une couleur par pôle : `informatique`, `communication`, `marketing`, `audiovisuel`, `impression` (et `-clair` pour les fonds clairs). Un élément qui porte `data-pole="marketing"` expose `--pole`, `--pole-clair`, `--pole-fond` et `--pole-trait` : `text-(--pole)`, `border-(--pole-trait)`…
- Polices : `font-titre` (Inter Tight), `font-sans` (Inter), `font-accent` (Cormorant Garamond italique), chargées depuis Google Fonts dans `src/layouts/Layout.astro`.
- Utilitaires du site : `gouttiere`, `section-y`, `fond-points`, `surtitre`, `titre-section`, `accent`, `effet-bouton`, `effet-carte`, `animate-defile`.

## Interactions

- **Nos expertises (pôles)** : motif ARIA « tabs » (clic, flèches gauche et droite, Début, Fin). Tout lien `data-voir-pole="…"` (pastilles des filiales et projets) ouvre l'onglet voulu et fait défiler jusqu'à `#expertises`.
- **Carrières** : le bouton « Candidature spontanée » fait défiler jusqu'au formulaire de contact et pré-sélectionne l'objet correspondant.
- **Menu mobile** sous 861 px ; il se ferme au clic sur un lien et avec la touche Échap.
- **Animations** : bandeau défilant et animation phygital coupés si le visiteur demande moins d'animations (`prefers-reduced-motion: reduce`).
- **Formulaires** : envoi en JSON sans rechargement ; sans JavaScript, envoi classique puis retour sur la page.
- **Newsletter** : la bannière du pied de page et la case « newsletter » du formulaire de contact n'apparaissent que si `fonctionnalites.newsletter` vaut `true` dans `src/config.ts` (par défaut `false`).

## Mise en ligne des formulaires

Le formulaire de contact envoie un e-mail à `lafrancosenegalaise@gmail.com` (ou à `CONTACT_TO`) et la newsletter inscrit le visiteur en double opt-in, tous deux via **Brevo**, depuis des fonctions **Vercel** (`api/contact.ts` et `api/newsletter.ts`). Rien ne fonctionne en ligne tant que les deux comptes ne sont pas configurés comme ci-dessous.

### 1. Dans Brevo

1. **Créer le compte** sur brevo.com (le plan gratuit suffit pour démarrer ; il limite le nombre d'e-mails par jour).
2. **Clé API** → `BREVO_API_KEY`. Menu du compte (en haut à droite) → *SMTP et API* → onglet *Clés API* → *Générer une nouvelle clé API*. Donnez-lui un nom (par exemple « site-lfs ») et copiez-la tout de suite (elle commence par `xkeysib-`). Ne la mettez jamais dans le code ni dans Git.
3. **Domaine et expéditeur** → `SENDER_EMAIL` (et `SENDER_NAME`). *Expéditeurs, domaines et IP dédiées* :
   - *Domaines* → *Ajouter un domaine* (`lafrancosenegalaise.com`), puis ajouter chez le gestionnaire DNS du domaine les enregistrements que Brevo affiche (code de vérification, **DKIM**, **DMARC**) et cliquer sur *Authentifier*.
   - *Expéditeurs* → *Ajouter un expéditeur* : une adresse sur ce domaine (par exemple `contact@lafrancosenegalaise.com`), validée par un e-mail de Brevo. C'est la valeur de `SENDER_EMAIL`. Une adresse Gmail comme expéditeur est déconseillée en production : les e-mails risquent d'être classés en spam.
4. **Liste « Newsletter »** → `BREVO_LIST_ID`. *Contacts* → *Listes* → *Créer une liste* nommée « Newsletter ». Notez son **numéro (ID)**, affiché dans le tableau des listes.
5. **Modèle de double opt-in** → `BREVO_DOI_TEMPLATE_ID`. *Marketing* → *Modèles d'e-mail* → créer un modèle avec un court texte de confirmation et un bouton (ou un lien) dont l'adresse est **exactement `{{ params.DOIurl }}`**. Sans ce lien, Brevo refuse le modèle. Évitez les variables du contact (prénom…) : il n'est pas encore inscrit. Choisissez l'expéditeur de l'étape 3, **activez** le modèle et notez son **numéro (ID)**.

Le visiteur clique sur le lien de confirmation, Brevo l'ajoute alors à la liste et le renvoie vers `SITE_URL/?newsletter=confirmee`.

### 2. Dans Vercel

1. **Importer le dépôt GitHub** : sur vercel.com, *Add New…* → *Project* → sélectionner le dépôt GitHub du site.
2. **Réglages de build** :
   - *Framework Preset* : **Astro** (détecté automatiquement).
   - *Build Command* : `npm run build`
   - *Output Directory* : `dist`
   - *Node.js Version* (dans *Settings* > *Build and Deployment* > *Node.js Version*) : **22.x**.
3. **Dossier `api/`** : placé à la racine du projet (`api/contact.ts` et `api/newsletter.ts`), Vercel le déploie automatiquement sous `/api/contact` et `/api/newsletter`.
4. **Variables d'environnement** (projet > *Settings* > *Environment Variables*, environnements *Production* et *Preview*) :

   | Variable | Sensible | Obligatoire | Valeur |
   | --- | --- | --- | --- |
   | `BREVO_API_KEY` | oui | oui | Clé API v3 Brevo (`xkeysib-…`, étape 1.2) |
   | `SENDER_EMAIL` | non | oui | Expéditeur authentifié (étape 1.3) |
   | `SENDER_NAME` | non | non | Nom affiché de l'expéditeur (défaut : « Site La Franco-Sénégalaise ») |
   | `CONTACT_TO` | non | non | Destinataire des demandes (défaut : `lafrancosenegalaise@gmail.com`) |
   | `BREVO_LIST_ID` | non | pour la newsletter | Numéro de la liste (étape 1.4) |
   | `BREVO_DOI_TEMPLATE_ID` | non | pour la newsletter | Numéro du modèle (étape 1.5) |
   | `SITE_URL` | non | pour la newsletter | Adresse du site avec `https://`, par exemple `https://lafrancosenegalaise.com` |
   | `TURNSTILE_SECRET_KEY` | oui | non | Clé secrète anti-spam Turnstile (étape 5) |
   | `PUBLIC_TURNSTILE_SITE_KEY` | non | non | Clé de site Turnstile lue au build (étape 5) |

5. **Anti-spam Cloudflare Turnstile (facultatif)** : Turnstile fonctionne sur n'importe quel hébergeur, y compris Vercel. Si vous souhaitez l'activer, créez un widget Turnstile pour le domaine `lafrancosenegalaise.com` : placez la **clé secrète** dans `TURNSTILE_SECRET_KEY` et la **clé de site** dans `PUBLIC_TURNSTILE_SITE_KEY` dans Vercel. Renseignez toujours les deux ensemble : avec la clé secrète seule, tous les envois sont refusés.
6. **Domaine** : projet > *Settings* > *Domains* > ajouter `lafrancosenegalaise.com`.
7. **Redéployer** (*Deployments* > *Redeploy*) après tout ajout ou modification de variable d'environnement, puis **tester un envoi** depuis le formulaire de contact en ligne et vérifier la réception dans la boîte `CONTACT_TO`.
8. **Activer la newsletter** : quand le domaine est authentifié chez Brevo et que les variables sont en place, passer `fonctionnalites.newsletter` à `true` dans `src/config.ts`, puis pousser sur GitHub.

### 3. Lire les journaux en cas d'échec

Dans Vercel > projet > onglet *Logs* (filtrer sur `/api/contact` ou `/api/newsletter`), envoyer le formulaire. Les messages commencent par `[contact]` ou `[newsletter]` et ne contiennent ni la clé API ni les données du visiteur.

| Message | Cause probable |
| --- | --- |
| `variable(s) absente(s)` ou `absente(s) ou invalide(s)` | Une variable du tableau est manquante ou mal saisie (le nom est indiqué) |
| `Brevo : envoi de l'e-mail … status: 401` | `BREVO_API_KEY` fausse, révoquée ou clé SMTP (`xsmtpsib-`) au lieu d'une clé API v3 (`xkeysib-`) |
| `Brevo : envoi de l'e-mail … status: 400` | Expéditeur `SENDER_EMAIL` non validé ou non authentifié chez Brevo (voir le message) |
| `Brevo : inscription double opt-in … status: 400` | Modèle sans le lien `{{ params.DOIurl }}`, modèle inactif ou numéro de liste faux |
| `status: 0, code: reseau` | Brevo injoignable |
| `Turnstile : jeton absent` | `PUBLIC_TURNSTILE_SITE_KEY` absente au build alors que `TURNSTILE_SECRET_KEY` est définie |
| `Turnstile : vérification refusée … invalid-input-secret` | `TURNSTILE_SECRET_KEY` fausse |
| `SITE_URL n'est pas une adresse valide` | `SITE_URL` sans `https://` |

### 4. Tester en local

- **Sans clé Brevo (tests unitaires)** : `npm test` exécute les 26 tests de `tests/fonctions.test.mjs` avec une API Brevo simulée.
- **Sans clé Brevo (aperçu visuel)** : mettre `PUBLIC_DEMO=true` dans `.env` puis lancer `npm run dev`.
- **Avec vraie clé Brevo en local** : copier `.env.local.example` en `.env.local` (ignoré par Git), remplir `BREVO_API_KEY`, `SENDER_EMAIL` et `CONTACT_TO`, mettre `PUBLIC_DEMO=false` dans `.env` et lancer `npm run dev` sur `http://localhost:4321`.

## À compléter avant la mise en ligne

- [ ] Adresse du site de Support Connecté : `supportConnecteUrl` dans `src/config.ts` (bouton « Visiter le site web » ; en attendant, il reste sur la carte).
- [ ] Domaine définitif : `site` dans `astro.config.mjs` et `SITE_URL` (`https://lafrancosenegalaise.com`).
- [ ] Raison sociale, forme juridique, adresse du siège, NINEA, RCCM, directeur de la publication : `src/config.ts`.
- [ ] Pages légales : hébergeur, durée de conservation, cookies. Ce sont des modèles, à faire valider.
- [ ] Logos officiels en SVG (plus nets), dont une version noire de chaque marque pour le bandeau.
- [ ] Google Search Console (sitemap), fiche Google Business Profile à Saly, statistiques sans cookies (ex. Vercel Web Analytics).

## Points de vigilance

- Les logos du bandeau sont passés en noir par un filtre CSS : chaque fichier doit avoir un **fond transparent**, sinon il devient un rectangle noir.
- Tailwind CSS 4 vise Safari 16.4+, Chrome 111+ et Firefox 128+ : sur de très vieux iPhone (iOS 15 et moins), une partie des styles ne s'applique pas.
- Les polices viennent de Google Fonts. Pour ne rien charger chez Google, les héberger dans `public/fonts` et remplacer le lien de `Layout.astro`.
