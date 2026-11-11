/**
 * POST /api/newsletter — inscription à la newsletter en double opt-in (API Brevo).
 *
 * Variables d'environnement à définir dans Vercel (Settings > Environment Variables) :
 *   BREVO_API_KEY           clé API Brevo (secret)
 *   BREVO_LIST_ID           identifiant numérique de la liste « Newsletter » dans Brevo
 *   BREVO_DOI_TEMPLATE_ID   identifiant numérique du modèle d'e-mail de confirmation (double opt-in)
 *   SITE_URL                adresse du site (pour la page de retour après confirmation)
 *
 * Les échecs sont écrits dans les journaux Vercel (statut et message de Brevo, jamais la clé ni
 * l'adresse du visiteur). Un contact déjà présent dans Brevo est traité comme une réussite.
 */
import { EMAIL_VALIDE, decrireErreur, inscrireNewsletter, lireDonnees } from '../lib/brevo';

function repondre(request: Request, ok: boolean, status = 200): Response {
	if ((request.headers.get('accept') ?? '').includes('application/json')) {
		return Response.json({ ok }, { status: ok ? 200 : status });
	}
	const retour = ok ? '/?newsletter=inscrit#newsletter' : '/#newsletter';
	return Response.redirect(new URL(retour, request.url).toString(), 303);
}

export async function POST(request: Request): Promise<Response> {
	try {
		let donnees: Record<string, string>;
		try {
			donnees = await lireDonnees(request);
		} catch {
			return repondre(request, false, 400);
		}

		if (donnees.site_web) return repondre(request, true);

		const email = donnees.email ?? '';
		if (!EMAIL_VALIDE.test(email) || email.length > 200) {
			return repondre(request, false, 400);
		}

		const issue = await inscrireNewsletter('newsletter', email);
		if (issue === 'ok' || issue === 'deja-inscrit') return repondre(request, true);
		if (issue === 'configuration') return repondre(request, false, 500);
		return repondre(request, false, 502);
	} catch (erreur) {
		console.error('[newsletter] erreur inattendue', decrireErreur(erreur));
		return repondre(request, false, 500);
	}
}
