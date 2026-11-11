/**
 * Tests des fonctions /api/contact et /api/newsletter, sans clé Brevo, sans réseau, sans Cloudflare.
 * `fetch` est remplacé par une simulation : on vérifie les appels que les fonctions feraient à Brevo.
 *
 * Lancer : npm test
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, describe, test } from 'node:test';

// Les fonctions importent « ../_brevo » sans extension (comme l'attend Cloudflare) ; Node veut « .ts ».
registerHooks({
	resolve(specifier, contexte, suivant) {
		if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$/.test(specifier)) {
			try {
				return suivant(`${specifier}.ts`, contexte);
			} catch {
				// on retombe sur la résolution normale
			}
		}
		return suivant(specifier, contexte);
	},
});

const { onRequestPost: contact } = await import('../functions/api/contact.ts');
const { onRequestPost: newsletter } = await import('../functions/api/newsletter.ts');

/* ------------------------------------------------------------ Outils */

const CLE = 'cle-de-test-brevo';
const EMAIL_VISITEUR = 'visiteur@exemple.test';
const MESSAGE_VISITEUR = 'Texte du message secret du visiteur';
const NOM_VISITEUR = 'Awa Visiteur';

const envBase = { BREVO_API_KEY: CLE, SENDER_EMAIL: 'expediteur@test.invalid' };
const envNewsletter = { ...envBase, BREVO_LIST_ID: '12', BREVO_DOI_TEMPLATE_ID: '34' };
const demande = { nom: NOM_VISITEUR, email: EMAIL_VISITEUR, message: MESSAGE_VISITEUR };

const fetchOriginal = globalThis.fetch;
const consoleErrorOriginal = console.error;
const consoleWarnOriginal = console.warn;

/** Appels faits à `fetch` et lignes écrites dans les journaux pendant le test en cours. */
let appels = [];
let journaux = [];

const reponseJson = (status, corps) =>
	new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const brevoAccepte = (url) => (String(url).endsWith('/smtp/email') ? reponseJson(201, { messageId: '<test@brevo>' }) : new Response(null, { status: 204 }));

/** Remplace fetch et capture console.error / console.warn. `reponse(url, init)` simule Brevo (ou Turnstile). */
function simuler(reponse = brevoAccepte) {
	appels = [];
	journaux = [];
	globalThis.fetch = async (url, init) => {
		const corps = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
		appels.push({ url: String(url), cle: init?.headers?.['api-key'], corps });
		return reponse(url, init);
	};
	console.error = (...args) => journaux.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
	console.warn = console.error;
}

afterEach(() => {
	globalThis.fetch = fetchOriginal;
	console.error = consoleErrorOriginal;
	console.warn = consoleWarnOriginal;
});

function requete(chemin, corps) {
	return new Request(`https://lafrancosenegalaise.com${chemin}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(corps),
	});
}

async function appeler(fonction, chemin, corps, env) {
	const reponse = await fonction({ request: requete(chemin, corps), env });
	return { status: reponse.status, corps: await reponse.json() };
}

const appelsBrevo = (suffixe) => appels.filter((a) => a.url.endsWith(suffixe));

function verifierJournauxSansDonneesSensibles() {
	const texte = journaux.join('\n');
	assert.ok(!texte.includes(CLE), 'la clé API ne doit jamais être journalisée');
	assert.ok(!texte.includes(EMAIL_VISITEUR), 'l’e-mail du visiteur ne doit jamais être journalisé');
	assert.ok(!texte.includes(MESSAGE_VISITEUR), 'le message du visiteur ne doit jamais être journalisé');
	assert.ok(!texte.includes(NOM_VISITEUR), 'le nom du visiteur ne doit jamais être journalisé');
}

/* ------------------------------------------------------------ /api/contact */

describe('/api/contact', () => {
	test('demande valide : un appel smtp/email avec api-key, destinataire par défaut et replyTo', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', demande, envBase);
		assert.equal(r.status, 200);
		assert.deepEqual(r.corps, { ok: true });
		assert.equal(appels.length, 1);
		const [appel] = appels;
		assert.equal(appel.url, 'https://api.brevo.com/v3/smtp/email');
		assert.equal(appel.cle, CLE);
		assert.equal(appel.corps.to[0].email, 'lafrancosenegalaise@gmail.com');
		assert.equal(appel.corps.replyTo.email, EMAIL_VISITEUR);
		assert.equal(appel.corps.sender.email, 'expediteur@test.invalid');
		assert.ok(appel.corps.textContent.includes(MESSAGE_VISITEUR));
	});

	test('CONTACT_TO est prioritaire sur le destinataire par défaut', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', demande, { ...envBase, CONTACT_TO: 'autre@exemple.test' });
		assert.equal(r.status, 200);
		assert.equal(appels[0].corps.to[0].email, 'autre@exemple.test');
	});

	test('un saut de ligne dans le sujet ou le nom ne s’insère pas dans l’objet de l’e-mail', async () => {
		simuler();
		await appeler(contact, '/api/contact', { ...demande, nom: 'Awa\r\nBcc: x@exemple.test', sujet: 'Objet\nBcc: y@exemple.test' }, envBase);
		assert.doesNotMatch(appels[0].corps.subject, /[\r\n]/);
	});

	test('nom manquant : 400 et aucun appel à Brevo', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', { ...demande, nom: '' }, envBase);
		assert.equal(r.status, 400);
		assert.deepEqual(r.corps, { ok: false });
		assert.equal(appels.length, 0);
	});

	test('e-mail invalide : 400 et aucun appel à Brevo', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', { ...demande, email: 'pas-un-email' }, envBase);
		assert.equal(r.status, 400);
		assert.equal(appels.length, 0);
	});

	test('message vide ou champ trop long : 400', async () => {
		simuler();
		assert.equal((await appeler(contact, '/api/contact', { ...demande, message: '' }, envBase)).status, 400);
		assert.equal((await appeler(contact, '/api/contact', { ...demande, societe: 'x'.repeat(201) }, envBase)).status, 400);
		assert.equal(appels.length, 0);
	});

	test('champ piège site_web rempli : 200 sans appel à Brevo', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', { ...demande, site_web: 'http://spam.test' }, envBase);
		assert.equal(r.status, 200);
		assert.deepEqual(r.corps, { ok: true });
		assert.equal(appels.length, 0);
	});

	test('BREVO_API_KEY absent : 500, journal explicite, aucun appel', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', demande, { SENDER_EMAIL: 'expediteur@test.invalid' });
		assert.equal(r.status, 500);
		assert.equal(appels.length, 0);
		assert.ok(journaux.join('\n').includes('BREVO_API_KEY'));
		verifierJournauxSansDonneesSensibles();
	});

	test('SENDER_EMAIL absent : 500, journal explicite, aucun appel', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', demande, { BREVO_API_KEY: CLE });
		assert.equal(r.status, 500);
		assert.equal(appels.length, 0);
		assert.ok(journaux.join('\n').includes('SENDER_EMAIL'));
		verifierJournauxSansDonneesSensibles();
	});

	test('Brevo répond 401 : 502, journal avec chemin, statut et message de Brevo, sans donnée sensible', async () => {
		simuler(() => reponseJson(401, { code: 'unauthorized', message: 'Key not found' }));
		const r = await appeler(contact, '/api/contact', demande, envBase);
		assert.equal(r.status, 502);
		assert.deepEqual(r.corps, { ok: false });
		const texte = journaux.join('\n');
		assert.ok(texte.includes('smtp/email'), 'le chemin appelé est journalisé');
		assert.ok(texte.includes('401'), 'le statut HTTP est journalisé');
		assert.ok(texte.includes('Key not found'), 'le message de Brevo est journalisé');
		verifierJournauxSansDonneesSensibles();
	});

	test('Brevo injoignable : 502 sans exception, journal sans donnée sensible', async () => {
		simuler(() => {
			throw new TypeError('Network connection lost.');
		});
		const r = await appeler(contact, '/api/contact', demande, envBase);
		assert.equal(r.status, 502);
		assert.ok(journaux.join('\n').includes('smtp/email'));
		verifierJournauxSansDonneesSensibles();
	});

	test('Turnstile actif sans jeton : 403 et aucun appel', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', demande, { ...envBase, TURNSTILE_SECRET_KEY: 'secret-turnstile-de-test' });
		assert.equal(r.status, 403);
		assert.deepEqual(r.corps, { ok: false });
		assert.equal(appels.length, 0);
	});

	test('Turnstile actif, jeton valide : envoi accepté ; jeton refusé : 403', async () => {
		simuler((url, init) => {
			if (String(url).includes('turnstile')) return reponseJson(200, { success: init.body.get('response') === 'jeton-valide' });
			return brevoAccepte(url);
		});
		const env = { ...envBase, TURNSTILE_SECRET_KEY: 'secret-turnstile-de-test' };
		assert.equal((await appeler(contact, '/api/contact', { ...demande, 'cf-turnstile-response': 'jeton-valide' }, env)).status, 200);
		assert.equal(appelsBrevo('/smtp/email').length, 1);
		assert.equal((await appeler(contact, '/api/contact', { ...demande, 'cf-turnstile-response': 'jeton-faux' }, env)).status, 403);
		assert.equal(appelsBrevo('/smtp/email').length, 1, 'aucun e-mail pour le jeton refusé');
	});

	test('case newsletter cochée avec liste et modèle : 2e appel doubleOptinConfirmation avec les bons identifiants', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', { ...demande, newsletter: 'oui' }, envNewsletter);
		assert.equal(r.status, 200);
		assert.equal(appels.length, 2);
		assert.equal(appels[0].url, 'https://api.brevo.com/v3/smtp/email');
		assert.equal(appels[1].url, 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation');
		assert.equal(appels[1].cle, CLE);
		assert.equal(appels[1].corps.email, EMAIL_VISITEUR);
		assert.deepEqual(appels[1].corps.includeListIds, [12]);
		assert.equal(appels[1].corps.templateId, 34);
		assert.equal(appels[1].corps.redirectionUrl, 'https://lafrancosenegalaise.com/?newsletter=confirmee');
	});

	test('SITE_URL définie : la redirection de confirmation l’utilise', async () => {
		simuler();
		await appeler(contact, '/api/contact', { ...demande, newsletter: 'oui' }, { ...envNewsletter, SITE_URL: 'https://exemple.test' });
		assert.equal(appels[1].corps.redirectionUrl, 'https://exemple.test/?newsletter=confirmee');
	});

	test('case newsletter cochée sans liste configurée : ignorée, la demande de contact part quand même', async () => {
		simuler();
		const r = await appeler(contact, '/api/contact', { ...demande, newsletter: 'oui' }, envBase);
		assert.equal(r.status, 200);
		assert.equal(appels.length, 1);
		assert.equal(appels[0].url, 'https://api.brevo.com/v3/smtp/email');
	});

	test('échec du double opt-in : la demande de contact reste un succès, l’échec est journalisé', async () => {
		simuler((url) => (String(url).endsWith('/smtp/email') ? brevoAccepte(url) : reponseJson(400, { code: 'invalid_parameter', message: 'Invalid template' })));
		const r = await appeler(contact, '/api/contact', { ...demande, newsletter: 'oui' }, envNewsletter);
		assert.equal(r.status, 200);
		assert.ok(journaux.join('\n').includes('contacts/doubleOptinConfirmation'));
		verifierJournauxSansDonneesSensibles();
	});

	test('envoi sans JavaScript : redirection 303 vers la page', async () => {
		simuler();
		const sansJson = new Request('https://lafrancosenegalaise.com/api/contact', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(demande).toString(),
		});
		const reponse = await contact({ request: sansJson, env: envBase });
		assert.equal(reponse.status, 303);
		assert.equal(reponse.headers.get('location'), 'https://lafrancosenegalaise.com/?demande=envoyee#contact');
	});
});

/* ------------------------------------------------------------ /api/newsletter */

describe('/api/newsletter', () => {
	test('e-mail valide : 200 et appel doubleOptinConfirmation avec liste, modèle et redirectionUrl', async () => {
		simuler();
		const r = await appeler(newsletter, '/api/newsletter', { email: EMAIL_VISITEUR }, envNewsletter);
		assert.equal(r.status, 200);
		assert.deepEqual(r.corps, { ok: true });
		assert.equal(appels.length, 1);
		assert.equal(appels[0].url, 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation');
		assert.equal(appels[0].cle, CLE);
		assert.equal(appels[0].corps.email, EMAIL_VISITEUR);
		assert.deepEqual(appels[0].corps.includeListIds, [12]);
		assert.equal(appels[0].corps.templateId, 34);
		assert.equal(appels[0].corps.redirectionUrl, 'https://lafrancosenegalaise.com/?newsletter=confirmee');
	});

	test('e-mail invalide : 400 et aucun appel', async () => {
		simuler();
		const r = await appeler(newsletter, '/api/newsletter', { email: 'abc' }, envNewsletter);
		assert.equal(r.status, 400);
		assert.equal(appels.length, 0);
	});

	test('champ piège rempli : 200 sans appel', async () => {
		simuler();
		const r = await appeler(newsletter, '/api/newsletter', { email: EMAIL_VISITEUR, site_web: 'x' }, envNewsletter);
		assert.equal(r.status, 200);
		assert.equal(appels.length, 0);
	});

	test('configuration absente : 500, variables manquantes journalisées, aucun appel', async () => {
		simuler();
		const r = await appeler(newsletter, '/api/newsletter', { email: EMAIL_VISITEUR }, {});
		assert.equal(r.status, 500);
		assert.equal(appels.length, 0);
		const texte = journaux.join('\n');
		assert.ok(texte.includes('BREVO_API_KEY') && texte.includes('BREVO_LIST_ID') && texte.includes('BREVO_DOI_TEMPLATE_ID'));
		verifierJournauxSansDonneesSensibles();
	});

	test('liste ou modèle manquant : 500', async () => {
		simuler();
		const r = await appeler(newsletter, '/api/newsletter', { email: EMAIL_VISITEUR }, envBase);
		assert.equal(r.status, 500);
		assert.equal(appels.length, 0);
	});

	test('Brevo refuse : 502, journal avec chemin, statut et message, sans donnée sensible', async () => {
		simuler(() => reponseJson(400, { code: 'invalid_parameter', message: 'Invalid templateId' }));
		const r = await appeler(newsletter, '/api/newsletter', { email: EMAIL_VISITEUR }, envNewsletter);
		assert.equal(r.status, 502);
		assert.deepEqual(r.corps, { ok: false });
		const texte = journaux.join('\n');
		assert.ok(texte.includes('contacts/doubleOptinConfirmation'));
		assert.ok(texte.includes('400'));
		assert.ok(texte.includes('Invalid templateId'));
		verifierJournauxSansDonneesSensibles();
	});

	test('contact déjà inscrit (Brevo répond 400 « already exist ») : traité comme un succès', async () => {
		simuler(() => reponseJson(400, { code: 'invalid_parameter', message: 'Contact already exist' }));
		const r = await appeler(newsletter, '/api/newsletter', { email: EMAIL_VISITEUR }, envNewsletter);
		assert.equal(r.status, 200);
		assert.deepEqual(r.corps, { ok: true });
		verifierJournauxSansDonneesSensibles();
	});

	test('JSON illisible : 400', async () => {
		simuler();
		const requeteCassee = new Request('https://lafrancosenegalaise.com/api/newsletter', {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: '{pas du json',
		});
		const reponse = await newsletter({ request: requeteCassee, env: envNewsletter });
		assert.equal(reponse.status, 400);
		assert.equal(appels.length, 0);
	});
});
