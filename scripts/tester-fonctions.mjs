/**
 * Test local des fonctions Cloudflare Pages (functions/api/contact.ts et newsletter.ts).
 *
 * Lance, sans aucune vraie clé :
 *   1. une API Brevo simulée et un faux service Turnstile (ce fichier, port 8799) ;
 *   2. `wrangler pages dev dist` (port 8790) avec des variables de test passées en ligne de commande.
 * Puis envoie des requêtes et vérifie les réponses, ce que Brevo aurait reçu et le contenu des journaux.
 *
 * Usage : npm run test:fonctions   (construit le site, puis lance ce script)
 * Aucune donnée n'est envoyée à Brevo ni à Cloudflare : les appels sont redirigés vers ce faux serveur.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';

const PORT_FAUX = 8799;
const PORT_SITE = 8790;
const SITE = `http://127.0.0.1:${PORT_SITE}`;
const CLE_DE_TEST = 'cle-de-test-brevo';

if (!existsSync('dist')) {
	console.error('Le dossier dist/ est absent : lancez « npm run build » d’abord (ou « npm run test:fonctions »).');
	process.exit(1);
}

/* ------------------------------------------------------------ Faux Brevo et faux Turnstile */

/** Requêtes reçues par le faux serveur depuis la dernière remise à zéro. */
let recues = [];

const fauxServeur = http.createServer(async (req, res) => {
	const morceaux = [];
	for await (const morceau of req) morceaux.push(morceau);
	const brut = Buffer.concat(morceaux).toString();
	const repondre = (status, corps) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(corps === undefined ? '' : JSON.stringify(corps));
	};

	if (req.url === '/v3/smtp/email' || req.url === '/v3/contacts/doubleOptinConfirmation') {
		let corps = {};
		try {
			corps = JSON.parse(brut);
		} catch {
			return repondre(400, { code: 'invalid_parameter', message: 'JSON invalide' });
		}
		recues.push({ chemin: req.url.replace('/v3/', ''), cle: req.headers['api-key'], corps });

		if (req.headers['api-key'] !== CLE_DE_TEST) return repondre(401, { code: 'unauthorized', message: 'Key not found' });

		if (req.url === '/v3/smtp/email') {
			// Déclencheur d'une panne Brevo ; le message contient une adresse pour vérifier qu'elle est masquée dans les journaux.
			if (String(corps.textContent).includes('SIMULER_ERREUR_BREVO')) {
				return repondre(500, { code: 'internal_server_error', message: 'Erreur simulée pour jean.dupont@exemple.test' });
			}
			return repondre(201, { messageId: '<simule@brevo.test>' });
		}
		if (String(corps.email).startsWith('deja@')) return repondre(400, { code: 'invalid_parameter', message: 'Contact already exist' });
		if (String(corps.email).startsWith('erreur@')) return repondre(500, { code: 'internal_server_error', message: 'Panne simulée' });
		return repondre(204);
	}

	if (req.url === '/turnstile/siteverify') {
		const jeton = /name="response"\r\n\r\n([^\r]*)/.exec(brut)?.[1] ?? '';
		recues.push({ chemin: 'turnstile', jeton });
		return jeton === 'jeton-valide'
			? repondre(200, { success: true })
			: repondre(200, { success: false, 'error-codes': ['invalid-input-response'] });
	}

	repondre(404, { code: 'not_found', message: 'Route inconnue du faux serveur' });
});

/* ------------------------------------------------------------ Wrangler */

let journal = '';
let wrangler;

function arreterWrangler() {
	if (!wrangler?.pid) return;
	try {
		if (process.platform === 'win32') execSync(`taskkill /pid ${wrangler.pid} /T /F`, { stdio: 'ignore' });
		else process.kill(-wrangler.pid, 'SIGTERM');
	} catch {
		// déjà arrêté
	}
	wrangler = undefined;
}

function demarrerWrangler() {
	const variables = {
		BREVO_API_KEY: CLE_DE_TEST,
		BREVO_API_URL: `http://127.0.0.1:${PORT_FAUX}/v3`,
		SENDER_EMAIL: 'expediteur@test.invalid',
		BREVO_LIST_ID: '7',
		BREVO_DOI_TEMPLATE_ID: '3',
		SITE_URL: 'https://site-de-test.invalid',
		TURNSTILE_SECRET_KEY: 'secret-turnstile-de-test',
		TURNSTILE_VERIFY_URL: `http://127.0.0.1:${PORT_FAUX}/turnstile/siteverify`,
	};
	// CONTACT_TO est volontairement absent : on vérifie le destinataire par défaut.
	const options = Object.entries(variables).map(([cle, valeur]) => `--binding ${cle}=${valeur}`);
	const commande = `npx --yes wrangler@4 pages dev dist --ip 127.0.0.1 --port ${PORT_SITE} --compatibility-date=2025-06-01 ${options.join(' ')}`;
	wrangler = spawn(commande, {
		shell: true,
		detached: process.platform !== 'win32',
		env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' },
	});
	wrangler.stdout.on('data', (donnees) => (journal += donnees));
	wrangler.stderr.on('data', (donnees) => (journal += donnees));
}

async function attendreSite() {
	const limite = Date.now() + 240_000;
	while (Date.now() < limite) {
		try {
			const reponse = await fetch(`${SITE}/`);
			if (reponse.ok) return;
		} catch {
			// pas encore prêt
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error(`wrangler n'a pas démarré à temps. Dernières lignes :\n${journal.split('\n').slice(-25).join('\n')}`);
}

/* ------------------------------------------------------------ Outils de test */

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let echecs = 0;
let reussites = 0;

function verifier(condition, libelle, detail = '') {
	if (condition) {
		reussites += 1;
		console.log(`   ✓ ${libelle}`);
	} else {
		echecs += 1;
		console.log(`   ✗ ${libelle}${detail ? `  → ${detail}` : ''}`);
	}
}

async function envoyer(chemin, corps, { json = true } = {}) {
	const enJson = json
		? { 'content-type': 'application/json', accept: 'application/json' }
		: { 'content-type': 'application/x-www-form-urlencoded' };
	const reponse = await fetch(`${SITE}${chemin}`, {
		method: 'POST',
		redirect: 'manual',
		headers: enJson,
		body: json ? JSON.stringify(corps) : new URLSearchParams(corps).toString(),
	});
	const texte = await reponse.text();
	let donnees;
	try {
		donnees = JSON.parse(texte);
	} catch {
		donnees = undefined;
	}
	return { status: reponse.status, donnees, location: reponse.headers.get('location') };
}

/** Lance un scénario et renvoie ce que Brevo a reçu et ce que les fonctions ont écrit dans les journaux. */
async function scenario(titre, action) {
	console.log(`\n▶ ${titre}`);
	recues = [];
	const debutJournal = journal.length;
	const reponse = await action();
	await pause(500); // laisse wrangler écrire ses journaux
	return { reponse, recues: [...recues], journal: journal.slice(debutJournal) };
}

const demande = {
	nom: 'Visiteur Secret',
	email: 'visiteur-secret@exemple.test',
	message: 'Bonjour, ceci est un message de test.',
	'cf-turnstile-response': 'jeton-valide',
};

/* ------------------------------------------------------------ Scénarios */

async function lancerLesTests() {
	let r;

	r = await scenario('Contact : envoi réussi (et objet protégé contre les sauts de ligne)', () =>
		envoyer('/api/contact', { ...demande, societe: 'Test SARL', telephone: '+221 77 000 00 00', sujet: 'Partenariat\r\nBcc: pirate@exemple.test' }),
	);
	verifier(r.reponse.status === 200 && r.reponse.donnees?.ok === true, 'réponse 200 { ok: true }', JSON.stringify(r.reponse));
	const mail = r.recues.find((x) => x.chemin === 'smtp/email');
	verifier(r.recues.filter((x) => x.chemin === 'smtp/email').length === 1, 'un seul e-mail envoyé à Brevo');
	verifier(mail?.cle === CLE_DE_TEST, 'la clé API est envoyée à Brevo dans l’en-tête api-key');
	verifier(mail?.corps.to?.[0]?.email === 'lafrancosenegalaise@gmail.com', 'destinataire par défaut : lafrancosenegalaise@gmail.com', JSON.stringify(mail?.corps.to));
	verifier(mail?.corps.sender?.email === 'expediteur@test.invalid', 'expéditeur = SENDER_EMAIL');
	verifier(mail?.corps.replyTo?.email === demande.email, 'réponse possible directement au visiteur (replyTo)');
	verifier(typeof mail?.corps.subject === 'string' && !/[\r\n]/.test(mail.corps.subject), 'objet de l’e-mail sur une seule ligne', JSON.stringify(mail?.corps.subject));
	verifier(String(mail?.corps.textContent).includes('Newsletter : non'), 'newsletter non cochée : « non » dans l’e-mail');
	verifier(!r.recues.some((x) => x.chemin === 'contacts/doubleOptinConfirmation'), 'pas d’inscription newsletter si la case n’est pas cochée');

	r = await scenario('Contact : case newsletter cochée → double opt-in', () => envoyer('/api/contact', { ...demande, newsletter: 'oui' }));
	verifier(r.reponse.status === 200, 'réponse 200', JSON.stringify(r.reponse));
	const doi = r.recues.find((x) => x.chemin === 'contacts/doubleOptinConfirmation');
	verifier(doi?.corps.email === demande.email, 'inscription demandée pour l’e-mail du visiteur');
	verifier(JSON.stringify(doi?.corps.includeListIds) === '[7]' && doi?.corps.templateId === 3, 'liste 7 et modèle 3 (BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID)');
	verifier(doi?.corps.redirectionUrl === 'https://site-de-test.invalid/?newsletter=confirmee', 'redirectionUrl construite avec SITE_URL', doi?.corps.redirectionUrl);

	r = await scenario('Contact : erreur Brevo (502) et journaux sans données sensibles', () =>
		envoyer('/api/contact', { ...demande, message: 'SIMULER_ERREUR_BREVO' }),
	);
	verifier(r.reponse.status === 502 && r.reponse.donnees?.ok === false, 'réponse 502 { ok: false }', JSON.stringify(r.reponse));
	verifier(r.journal.includes('[contact] Brevo') && r.journal.includes('500') && r.journal.includes('internal_server_error'), 'journal : statut et code renvoyés par Brevo');
	verifier(r.journal.includes('Erreur simulée'), 'journal : message renvoyé par Brevo');
	verifier(!r.journal.includes(CLE_DE_TEST), 'journal : la clé API n’apparaît pas');
	verifier(!r.journal.includes('visiteur-secret') && !r.journal.includes('Visiteur Secret'), 'journal : ni le nom ni l’e-mail du visiteur');
	verifier(!r.journal.includes('jean.dupont@exemple.test'), 'journal : une adresse contenue dans le message de Brevo est masquée');

	r = await scenario('Contact : e-mail invalide, message vide, champ trop long (400)', async () => ({
		a: await envoyer('/api/contact', { ...demande, email: 'pas-un-email' }),
		b: await envoyer('/api/contact', { ...demande, message: '' }),
		c: await envoyer('/api/contact', { ...demande, societe: 'x'.repeat(201) }),
	}));
	verifier(r.reponse.a.status === 400, 'e-mail invalide → 400', String(r.reponse.a.status));
	verifier(r.reponse.b.status === 400, 'message vide → 400', String(r.reponse.b.status));
	verifier(r.reponse.c.status === 400, 'champ « organisation » trop long → 400', String(r.reponse.c.status));
	verifier(r.recues.length === 0, 'rien n’est envoyé à Brevo');

	r = await scenario('Contact : champ piège rempli (robot)', () => envoyer('/api/contact', { ...demande, site_web: 'http://spam.test' }));
	verifier(r.reponse.status === 200 && r.reponse.donnees?.ok === true, 'réponse 200 comme si tout allait bien (le robot ne le saura pas)');
	verifier(r.recues.length === 0, 'rien n’est envoyé à Brevo, Turnstile n’est même pas appelé');

	r = await scenario('Contact : Turnstile refusé (403)', async () => {
		const { 'cf-turnstile-response': _jeton, ...sansJeton } = demande;
		return { absent: await envoyer('/api/contact', sansJeton), mauvais: await envoyer('/api/contact', { ...demande, 'cf-turnstile-response': 'jeton-invalide' }) };
	});
	verifier(r.reponse.absent.status === 403, 'jeton absent → 403', String(r.reponse.absent.status));
	verifier(r.reponse.mauvais.status === 403, 'jeton refusé par Turnstile → 403', String(r.reponse.mauvais.status));
	verifier(!r.recues.some((x) => x.chemin === 'smtp/email'), 'aucun e-mail envoyé');
	verifier(r.journal.includes('Turnstile'), 'journal : la cause Turnstile est écrite');

	r = await scenario('Contact : envoi sans JavaScript (formulaire classique)', () => envoyer('/api/contact', demande, { json: false }));
	verifier(r.reponse.status === 303 && r.reponse.location?.endsWith('/?demande=envoyee#contact'), 'redirection 303 vers /?demande=envoyee#contact', JSON.stringify(r.reponse));
	verifier(r.recues.some((x) => x.chemin === 'smtp/email'), 'l’e-mail part bien vers Brevo');

	r = await scenario('Newsletter : inscription réussie', () => envoyer('/api/newsletter', { email: 'nouveau@exemple.test' }));
	verifier(r.reponse.status === 200 && r.reponse.donnees?.ok === true, 'réponse 200 { ok: true }', JSON.stringify(r.reponse));
	const inscription = r.recues.find((x) => x.chemin === 'contacts/doubleOptinConfirmation');
	verifier(inscription?.corps.email === 'nouveau@exemple.test' && inscription?.corps.templateId === 3, 'demande de double opt-in envoyée à Brevo');

	r = await scenario('Newsletter : contact déjà inscrit (Brevo répond 400 « already exist »)', () => envoyer('/api/newsletter', { email: 'deja@exemple.test' }));
	verifier(r.reponse.status === 200 && r.reponse.donnees?.ok === true, 'traité comme une réussite (200)', JSON.stringify(r.reponse));
	verifier(!r.journal.includes('[wrangler:error]'), 'pas d’erreur dans les journaux');

	r = await scenario('Newsletter : erreur Brevo (502)', () => envoyer('/api/newsletter', { email: 'erreur@exemple.test' }));
	verifier(r.reponse.status === 502 && r.reponse.donnees?.ok === false, 'réponse 502 { ok: false }', JSON.stringify(r.reponse));
	verifier(r.journal.includes('[newsletter] Brevo') && r.journal.includes('500'), 'journal : statut renvoyé par Brevo');
	verifier(!r.journal.includes('erreur@exemple.test') && !r.journal.includes(CLE_DE_TEST), 'journal : ni l’e-mail du visiteur ni la clé API');

	r = await scenario('Newsletter : e-mail invalide, JSON illisible, champ piège', async () => {
		const illisible = await fetch(`${SITE}/api/newsletter`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: '{pas du json',
		});
		return {
			invalide: await envoyer('/api/newsletter', { email: 'abc' }),
			illisible: illisible.status,
			piege: await envoyer('/api/newsletter', { email: 'robot@exemple.test', site_web: 'x' }),
		};
	});
	verifier(r.reponse.invalide.status === 400, 'e-mail invalide → 400', String(r.reponse.invalide.status));
	verifier(r.reponse.illisible === 400, 'JSON illisible → 400', String(r.reponse.illisible));
	verifier(r.reponse.piege.status === 200, 'champ piège rempli → 200', String(r.reponse.piege.status));
	verifier(r.recues.length === 0, 'rien n’est envoyé à Brevo');
}

/* ------------------------------------------------------------ Exécution */

process.on('exit', arreterWrangler);
process.on('SIGINT', () => process.exit(130));

try {
	await new Promise((resolve) => fauxServeur.listen(PORT_FAUX, '127.0.0.1', resolve));
	console.log(`Faux Brevo / faux Turnstile sur http://127.0.0.1:${PORT_FAUX}`);
	console.log('Démarrage de wrangler pages dev (la première fois, npx télécharge wrangler : patientez)…');
	demarrerWrangler();
	await attendreSite();
	console.log(`Site local prêt sur ${SITE}`);
	await lancerLesTests();
	console.log(`\nRésultat : ${reussites} vérification(s) réussie(s), ${echecs} échec(s).`);
	if (echecs > 0) {
		console.log('\nDernières lignes du journal de wrangler :');
		console.log(journal.split('\n').slice(-40).join('\n'));
	}
} catch (erreur) {
	echecs += 1;
	console.error(erreur instanceof Error ? erreur.message : erreur);
} finally {
	arreterWrangler();
	fauxServeur.close();
	process.exit(echecs > 0 ? 1 : 0);
}
