/**
 * Formulaire de contact et inscription à la newsletter : envoi sans rechargement vers les
 * fonctions Vercel (/api/contact, /api/newsletter), message de remerciement ou d'erreur,
 * champ piège et, si une clé est fournie, widget anti-spam Cloudflare Turnstile.
 * Avec data-demo="true" sur le formulaire (PUBLIC_DEMO=true), l'envoi est simulé.
 */

interface TurnstileApi {
	render: (conteneur: HTMLElement, options: Record<string, unknown>) => string;
	reset: (widget?: string) => void;
}

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function lireChamps(formulaire: HTMLFormElement): Record<string, string> {
	const donnees: Record<string, string> = {};
	new FormData(formulaire).forEach((valeur, cle) => {
		if (typeof valeur === 'string') donnees[cle] = valeur.trim();
	});
	return donnees;
}

async function envoyer(formulaire: HTMLFormElement, donnees: Record<string, string>): Promise<void> {
	if (formulaire.dataset.demo === 'true') {
		await pause(700);
		return;
	}
	const reponse = await fetch(formulaire.action, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(donnees),
	});
	if (!reponse.ok) throw new Error(`Envoi refusé (${reponse.status})`);
}

/* ---------------------------------------------------------------- Turnstile */

let widgetTurnstile: string | undefined;

function chargerTurnstile(conteneur: HTMLElement): void {
	const sitekey = conteneur.dataset.sitekey;
	if (!sitekey) return;
	const afficher = () => {
		if (window.turnstile && widgetTurnstile === undefined) {
			widgetTurnstile = window.turnstile.render(conteneur, { sitekey, language: 'fr', theme: 'light' });
		}
	};
	if (window.turnstile) {
		afficher();
		return;
	}
	const script = document.createElement('script');
	script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	script.async = true;
	script.addEventListener('load', afficher);
	document.head.append(script);
}

const relancerTurnstile = () => {
	if (widgetTurnstile !== undefined) window.turnstile?.reset(widgetTurnstile);
};

/* ---------------------------------------------------------------- Contact */

const contact = document.querySelector<HTMLFormElement>('form[data-formulaire="contact"]');

if (contact) {
	const merci = document.querySelector<HTMLElement>('[data-merci="contact"]');
	const erreur = contact.querySelector<HTMLElement>('[data-erreur]');
	const bouton = contact.querySelector<HTMLButtonElement>('button[type="submit"]');
	const libelleBouton = contact.querySelector<HTMLElement>('[data-libelle-envoi]');
	const turnstile = contact.querySelector<HTMLElement>('[data-turnstile]');
	if (turnstile) chargerTurnstile(turnstile);

	const afficherMerci = (envoye: boolean): void => {
		contact.hidden = envoye;
		if (merci) merci.hidden = !envoye;
	};

	contact.addEventListener('submit', async (evenement) => {
		evenement.preventDefault();
		if (erreur) erreur.hidden = true;
		const donnees = lireChamps(contact);
		if (donnees.site_web) {
			afficherMerci(true); // champ piège rempli : robot
			return;
		}
		if (bouton) bouton.disabled = true;
		if (libelleBouton) libelleBouton.textContent = 'Envoi en cours…';
		try {
			await envoyer(contact, donnees);
			contact.reset();
			afficherMerci(true);
		} catch {
			if (erreur) erreur.hidden = false;
		} finally {
			if (bouton) bouton.disabled = false;
			if (libelleBouton) libelleBouton.textContent = 'Envoyer';
			relancerTurnstile();
		}
	});

	document.querySelector('[data-nouvelle-demande]')?.addEventListener('click', () => {
		afficherMerci(false);
		contact.querySelector<HTMLInputElement>('#f-nom')?.focus();
	});

	// Pré-sélection d'un sujet depuis un bouton de la page (ex. « Candidature spontanée »).
	document.addEventListener('click', (evenement) => {
		const declencheur = (evenement.target as Element | null)?.closest<HTMLElement>('[data-sujet-contact]');
		if (!declencheur?.dataset.sujetContact) return;
		afficherMerci(false);
		const choix = contact.querySelector<HTMLSelectElement>('#f-sujet');
		if (choix) choix.value = declencheur.dataset.sujetContact;
	});

	// Retour d'un envoi fait sans JavaScript (la fonction renvoie vers /?demande=envoyee#contact).
	if (new URLSearchParams(window.location.search).get('demande') === 'envoyee') afficherMerci(true);
}

/* ---------------------------------------------------------------- Newsletter */

const newsletter = document.querySelector<HTMLFormElement>('form[data-formulaire="newsletter"]');

if (newsletter) {
	const merci = document.querySelector<HTMLElement>('[data-merci="newsletter"]');
	const erreur = newsletter.querySelector<HTMLElement>('[data-erreur]');
	const bouton = newsletter.querySelector<HTMLButtonElement>('button[type="submit"]');

	const afficherMerci = (): void => {
		newsletter.hidden = true;
		if (merci) merci.hidden = false;
	};

	newsletter.addEventListener('submit', async (evenement) => {
		evenement.preventDefault();
		if (erreur) erreur.hidden = true;
		const donnees = lireChamps(newsletter);
		if (donnees.site_web) {
			afficherMerci();
			return;
		}
		if (bouton) bouton.disabled = true;
		try {
			await envoyer(newsletter, donnees);
			afficherMerci();
		} catch {
			if (erreur) erreur.hidden = false;
		} finally {
			if (bouton) bouton.disabled = false;
		}
	});

	if (new URLSearchParams(window.location.search).get('newsletter') === 'inscrit') afficherMerci();
}

export {};
