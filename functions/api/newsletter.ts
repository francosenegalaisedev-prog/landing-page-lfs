/**
 * POST /api/newsletter — inscription en double opt-in (Brevo envoie l'e-mail de confirmation).
 *
 * Variables à définir dans Cloudflare Pages :
 *   BREVO_API_KEY          clé API Brevo (secret)
 *   BREVO_LIST_ID          numéro de la liste Brevo « Newsletter »
 *   BREVO_DOI_TEMPLATE_ID  numéro du modèle d'e-mail de confirmation (double opt-in)
 *   SITE_URL               adresse du site (page vers laquelle renvoie la confirmation)
 *
 * Les échecs sont écrits dans les journaux Cloudflare (statut et message de Brevo, jamais la clé ni
 * l'adresse du visiteur). Réponses : 200 inscription prise en compte, 400 requête invalide,
 * 500 variables manquantes, 502 Brevo a refusé ou n'a pas répondu.
 */
import { EMAIL_VALIDE, decrireErreur, inscrireNewsletter, lireDonnees, type EnvBrevo } from '../_brevo';

interface Contexte {
	request: Request;
	env: EnvBrevo;
}

function repondre(request: Request, ok: boolean, status = 200): Response {
	if ((request.headers.get('accept') ?? '').includes('application/json')) {
		return Response.json({ ok }, { status: ok ? 200 : status });
	}
	const retour = ok ? '/?newsletter=inscrit#newsletter' : '/#newsletter';
	return Response.redirect(new URL(retour, request.url).toString(), 303);
}

export async function onRequestPost({ request, env }: Contexte): Promise<Response> {
	try {
		let donnees: Record<string, string>;
		try {
			donnees = await lireDonnees(request);
		} catch {
			return repondre(request, false, 400);
		}

		if (donnees.site_web) return repondre(request, true); // champ piège : un robot

		const email = donnees.email ?? '';
		if (!EMAIL_VALIDE.test(email) || email.length > 200) return repondre(request, false, 400);

		const issue = await inscrireNewsletter('newsletter', env, email);
		if (issue === 'configuration') return repondre(request, false, 500);
		if (issue === 'echec') return repondre(request, false, 502);
		// 'ok' ou 'deja-inscrit' : même réponse, pour ne pas révéler qui est déjà dans la liste.
		return repondre(request, true);
	} catch (erreur) {
		console.error('[newsletter] erreur inattendue', decrireErreur(erreur));
		return repondre(request, false, 500);
	}
}
