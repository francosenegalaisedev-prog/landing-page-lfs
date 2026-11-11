/**
 * Outils partagés par les fonctions /api/contact et /api/newsletter (appels à Brevo, journaux).
 * Ce fichier n'exporte aucune route : Cloudflare Pages ne le publie pas comme adresse.
 *
 * Règle des journaux : on écrit le statut, le code et le message renvoyés par Brevo, jamais la clé API
 * ni les données du visiteur (les adresses e-mail éventuelles d'un message d'erreur sont masquées).
 */

export const API_BREVO_PAR_DEFAUT = 'https://api.brevo.com/v3';
export const SITE_PAR_DEFAUT = 'https://lafrancosenegalaise.com';
export const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EnvBrevo {
	BREVO_API_KEY?: string;
	/** Pour les tests uniquement (API Brevo simulée). Ne jamais définir en production. */
	BREVO_API_URL?: string;
	BREVO_LIST_ID?: string;
	BREVO_DOI_TEMPLATE_ID?: string;
	SITE_URL?: string;
}

export interface ResultatBrevo {
	ok: boolean;
	/** Chemin de l'API Brevo appelé (ex. smtp/email). */
	chemin: string;
	/** Code HTTP renvoyé par Brevo ; 0 si Brevo n'a pas pu être joint. */
	status: number;
	code?: string;
	message?: string;
}

/** Texte sûr pour un journal : une seule ligne, adresses e-mail masquées, 200 caractères au plus. */
export function nettoyerPourJournal(texte: unknown): string {
	if (typeof texte !== 'string') return '';
	return texte
		.replace(/[^\s@]+@[^\s@]+/g, '[e-mail]')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 200);
}

/** Texte d'une erreur inattendue, sans donnée du visiteur. */
export function decrireErreur(erreur: unknown): string {
	return erreur instanceof Error ? `${erreur.name}: ${nettoyerPourJournal(erreur.message)}` : 'erreur inconnue';
}

/** Retire les sauts de ligne d'une valeur destinée à un objet d'e-mail ou à un nom d'expéditeur. */
export function surUneLigne(valeur: string): string {
	return valeur.replace(/[\r\n\t]+/g, ' ').trim();
}

export async function lireDonnees(request: Request): Promise<Record<string, string>> {
	const donnees: Record<string, string> = {};
	if ((request.headers.get('content-type') ?? '').includes('application/json')) {
		const brut: unknown = await request.json();
		if (brut && typeof brut === 'object') {
			for (const [cle, valeur] of Object.entries(brut)) {
				if (typeof valeur === 'string') donnees[cle] = valeur.trim();
			}
		}
		return donnees;
	}
	const formulaire = await request.formData();
	formulaire.forEach((valeur, cle) => {
		if (typeof valeur === 'string') donnees[cle] = valeur.trim();
	});
	return donnees;
}

/** Appelle l'API Brevo. Ne lève jamais d'exception : une panne réseau devient { ok: false, status: 0 }. */
export async function appelerBrevo(env: EnvBrevo, chemin: string, corps: unknown): Promise<ResultatBrevo> {
	const base = env.BREVO_API_URL || API_BREVO_PAR_DEFAUT;
	let reponse: Response;
	try {
		reponse = await fetch(`${base}/${chemin}`, {
			method: 'POST',
			headers: { 'api-key': env.BREVO_API_KEY ?? '', 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify(corps),
		});
	} catch (erreur) {
		return { ok: false, chemin, status: 0, code: 'reseau', message: nettoyerPourJournal(erreur instanceof Error ? erreur.message : '') };
	}
	if (reponse.ok) return { ok: true, chemin, status: reponse.status };

	let code: string | undefined;
	let message: string | undefined;
	try {
		const detail = (await reponse.json()) as { code?: unknown; message?: unknown };
		if (typeof detail.code === 'string') code = nettoyerPourJournal(detail.code);
		if (typeof detail.message === 'string') message = nettoyerPourJournal(detail.message);
	} catch {
		// Réponse sans corps JSON : le statut suffit.
	}
	return { ok: false, chemin, status: reponse.status, code, message };
}

export function journaliserEchecBrevo(fonction: string, action: string, resultat: ResultatBrevo): void {
	console.error(`[${fonction}] Brevo : ${action} a échoué`, {
		chemin: resultat.chemin,
		status: resultat.status,
		code: resultat.code ?? null,
		message: resultat.message ?? null,
	});
}

/** Brevo refuse parfois un contact déjà connu (400 « Contact already exist ») : ce n'est pas une panne. */
function estDejaInscrit(resultat: ResultatBrevo): boolean {
	return resultat.status === 400 && /already|exist/i.test(resultat.message ?? '');
}

export type IssueInscription = 'ok' | 'deja-inscrit' | 'echec' | 'configuration';

/**
 * Inscription en double opt-in : Brevo envoie lui-même l'e-mail de confirmation (modèle BREVO_DOI_TEMPLATE_ID)
 * et ne met le contact dans la liste BREVO_LIST_ID qu'une fois le lien cliqué.
 */
export async function inscrireNewsletter(fonction: string, env: EnvBrevo, email: string): Promise<IssueInscription> {
	const liste = Number(env.BREVO_LIST_ID);
	const modele = Number(env.BREVO_DOI_TEMPLATE_ID);
	const manquantes: string[] = [];
	if (!env.BREVO_API_KEY) manquantes.push('BREVO_API_KEY');
	if (!Number.isInteger(liste) || liste <= 0) manquantes.push('BREVO_LIST_ID');
	if (!Number.isInteger(modele) || modele <= 0) manquantes.push('BREVO_DOI_TEMPLATE_ID');
	if (manquantes.length > 0) {
		console.error(`[${fonction}] Newsletter : variable(s) absente(s) ou invalide(s)`, { variables: manquantes });
		return 'configuration';
	}

	let redirectionUrl: string;
	try {
		redirectionUrl = new URL('/?newsletter=confirmee', env.SITE_URL || SITE_PAR_DEFAUT).toString();
	} catch {
		console.error(`[${fonction}] Newsletter : SITE_URL n'est pas une adresse valide (attendu : https://votre-domaine)`);
		return 'configuration';
	}

	const resultat = await appelerBrevo(env, 'contacts/doubleOptinConfirmation', {
		email,
		includeListIds: [liste],
		templateId: modele,
		redirectionUrl,
	});
	if (resultat.ok) return 'ok';
	if (estDejaInscrit(resultat)) {
		console.warn(`[${fonction}] Newsletter : contact déjà connu de Brevo, traité comme une réussite`, {
			chemin: resultat.chemin,
			status: resultat.status,
			code: resultat.code ?? null,
		});
		return 'deja-inscrit';
	}
	journaliserEchecBrevo(fonction, 'inscription double opt-in', resultat);
	return 'echec';
}
