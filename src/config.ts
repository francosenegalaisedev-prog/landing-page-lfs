/**
 * Coordonnées et liens de la maison mère.
 * Les valeurs entre crochets sont à compléter avant la mise en ligne (voir README).
 */
export const site = {
	nom: 'La Franco-Sénégalaise',
	email: 'contact@lafrancosenegalaise.com',
	telephoneSenegal: { affichage: '(+221) 33 999 41 11', lien: 'tel:+221339994111' },
	telephoneFrance: { affichage: '(+33) 6 16 16 00 99', lien: 'tel:+33616160099' },
	siege: 'Saly, Sénégal',

	/** Adresse du site de Support Connecté (bouton « Visiter le site web ») : À RENSEIGNER. */
	supportConnecteUrl: '',

	/** Informations légales du pied de page et de la page Mentions légales. */
	legal: {
		raisonSociale: '[Dénomination sociale, forme juridique, capital]',
		adresse: '[adresse]',
		ninea: '[à compléter]',
		rccm: '[à compléter]',
		directeurPublication: '[à compléter]',
	},

	titre: 'La Franco-Sénégalaise | Maison mère : du pixel à l’espace physique',
	description:
		'La Franco-Sénégalaise est la maison mère d’un groupe d’entreprises établi au Sénégal. Elle pilote, conseille et accompagne ses filiales, des outils numériques de dernière génération jusqu’aux supports physiques.',
} as const;

/**
 * Interrupteur de la newsletter : bannière d'inscription du pied de page et case « newsletter »
 * du formulaire de contact. Laisser à false tant que le domaine n'est pas authentifié chez Brevo
 * (SPF, DKIM, DMARC) et que la liste, le modèle de double opt-in et les variables des fonctions
 * ne sont pas en place (voir README, « Mise en ligne des formulaires »). Passer à true ensuite.
 */
export const fonctionnalites = {
	newsletter: true,
};

/** Envoi des formulaires : fonctions Vercel du dossier api/. */
export const formulaires = {
	contact: '/api/contact',
	newsletter: '/api/newsletter',
	/** Clé de site Cloudflare Turnstile (vide : pas de widget anti-spam). */
	turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '',
	/** PUBLIC_DEMO=true : envoi simulé, pour un aperçu sans serveur. */
	demo: import.meta.env.PUBLIC_DEMO === 'true',
};
