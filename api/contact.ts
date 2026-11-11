/**
 * POST /api/contact — formulaire de contact → e-mail à la maison mère (API Brevo).
 *
 * Variables d'environnement à définir dans Vercel (Settings > Environment Variables) :
 *   BREVO_API_KEY          clé API Brevo (secret)
 *   SENDER_EMAIL           expéditeur authentifié chez Brevo (adresse sur le domaine du site)
 *   SENDER_NAME            facultatif, nom de l'expéditeur
 *   CONTACT_TO             facultatif, destinataire (par défaut lafrancosenegalaise@gmail.com)
 *   TURNSTILE_SECRET_KEY   si le widget Cloudflare Turnstile est activé (PUBLIC_TURNSTILE_SITE_KEY au build)
 *   BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID, SITE_URL : pour la case « newsletter » (double opt-in)
 *
 * Répond en JSON au script de la page ; un envoi sans JavaScript est renvoyé vers la page.
 * Réponses : 200 envoyé, 400 requête invalide, 403 anti-spam refusé, 500 variables manquantes,
 * 502 Brevo ou Turnstile a refusé ou n'a pas répondu.
 * Les échecs sont écrits dans les journaux Vercel (statut et message de Brevo, jamais la clé
 * ni les données du visiteur).
 */
import {
	EMAIL_VALIDE,
	appelerBrevo,
	decrireErreur,
	inscrireNewsletter,
	journaliserEchecBrevo,
	lireDonnees,
	nettoyerPourJournal,
	surUneLigne,
} from '../lib/brevo';

declare const process: { env: Record<string, string | undefined> };

const URL_TURNSTILE_PAR_DEFAUT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DESTINATAIRE_PAR_DEFAUT = 'lafrancosenegalaise@gmail.com';

function repondre(request: Request, ok: boolean, status = 200): Response {
	if ((request.headers.get('accept') ?? '').includes('application/json')) {
		return Response.json({ ok }, { status: ok ? 200 : status });
	}
	const retour = ok ? '/?demande=envoyee#contact' : '/#contact';
	return Response.redirect(new URL(retour, request.url).toString(), 303);
}

type VerdictTurnstile = 'ok' | 'refuse' | 'indisponible';

async function verifierTurnstile(jeton: string | undefined, ip: string | null): Promise<VerdictTurnstile> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) return 'ok'; // Turnstile non activé
	if (!jeton) {
		console.warn('[contact] Turnstile : jeton absent (robot, ou PUBLIC_TURNSTILE_SITE_KEY non définie au build ?)');
		return 'refuse';
	}
	const corps = new FormData();
	corps.append('secret', secret);
	corps.append('response', jeton);
	if (ip) corps.append('remoteip', ip);
	try {
		const reponse = await fetch(process.env.TURNSTILE_VERIFY_URL || URL_TURNSTILE_PAR_DEFAUT, { method: 'POST', body: corps });
		const resultat = (await reponse.json()) as { success?: boolean; 'error-codes'?: unknown };
		if (resultat.success === true) return 'ok';
		const codes = Array.isArray(resultat['error-codes']) ? resultat['error-codes'].map((c) => nettoyerPourJournal(c)) : [];
		// Une clé secrète fausse est une erreur de configuration ; un jeton refusé est un cas courant (robot, jeton expiré).
		const configuration = codes.some((code) => code === 'invalid-input-secret' || code === 'missing-input-secret');
		(configuration ? console.error : console.warn)('[contact] Turnstile : vérification refusée', { codes });
		return 'refuse';
	} catch (erreur) {
		console.error('[contact] Turnstile : service injoignable ou réponse illisible', decrireErreur(erreur));
		return 'indisponible';
	}
}

export async function POST(request: Request): Promise<Response> {
	try {
		let donnees: Record<string, string>;
		try {
			donnees = await lireDonnees(request);
		} catch {
			return repondre(request, false, 400);
		}

		// Champ piège rempli : un robot. On répond comme si tout allait bien.
		if (donnees.site_web) return repondre(request, true);

		const nom = donnees.nom ?? '';
		const email = donnees.email ?? '';
		const message = donnees.message ?? '';
		const societe = donnees.societe ?? '';
		const telephone = donnees.telephone ?? '';
		const sujet = donnees.sujet ?? '';
		if (
			!nom || nom.length > 200 ||
			!EMAIL_VALIDE.test(email) || email.length > 200 ||
			!message || message.length > 5000 ||
			societe.length > 200 || telephone.length > 50 || sujet.length > 200
		) {
			return repondre(request, false, 400);
		}

		const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
		const verdict = await verifierTurnstile(donnees['cf-turnstile-response'], ip);
		if (verdict === 'refuse') return repondre(request, false, 403);
		if (verdict === 'indisponible') return repondre(request, false, 502);

		const cleApi = process.env.BREVO_API_KEY;
		const expediteur = process.env.SENDER_EMAIL;
		const manquantes = [!cleApi && 'BREVO_API_KEY', !expediteur && 'SENDER_EMAIL'].filter(Boolean);
		if (manquantes.length > 0) {
			console.error('[contact] variable(s) absente(s) : le message ne peut pas être envoyé', { variables: manquantes });
			return repondre(request, false, 500);
		}

		const texte = [
			`Nom : ${nom}`,
			`Organisation : ${societe || '—'}`,
			`E-mail : ${email}`,
			`Téléphone : ${telephone || '—'}`,
			`Objet : ${sujet || '—'}`,
			`Newsletter : ${donnees.newsletter ? 'oui' : 'non'}`,
			'',
			message,
		].join('\n');

		const envoi = await appelerBrevo('smtp/email', {
			sender: { email: expediteur, name: surUneLigne(process.env.SENDER_NAME || 'Site La Franco-Sénégalaise') },
			to: [{ email: process.env.CONTACT_TO || DESTINATAIRE_PAR_DEFAUT }],
			replyTo: { email, name: surUneLigne(nom) },
			subject: surUneLigne(`[Site] ${sujet || 'Nouvelle demande'} : ${nom}`),
			textContent: texte,
		});
		if (!envoi.ok) {
			journaliserEchecBrevo('contact', 'envoi de l’e-mail (smtp/email)', envoi);
			return repondre(request, false, 502);
		}

		// Case « newsletter » cochée : inscription en double opt-in. Son échec ne doit pas faire échouer
		// la demande de contact, déjà envoyée ; il est écrit dans les journaux.
		if (donnees.newsletter) await inscrireNewsletter('contact', email);

		return repondre(request, true);
	} catch (erreur) {
		console.error('[contact] erreur inattendue', decrireErreur(erreur));
		return repondre(request, false, 500);
	}
}
