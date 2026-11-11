/**
 * Onglets des pôles (motif ARIA « tabs ») : clic, flèches gauche et droite, Début et Fin.
 * Tout lien portant data-voir-pole="…" (pastilles des filiales et projets) ouvre l'onglet voulu ;
 * son href="#expertises" fait défiler la page jusqu'à la section.
 */

const onglets = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-onglet]'));
const panneaux = Array.from(document.querySelectorAll<HTMLElement>('[data-panneau]'));

function ouvrir(id: string, donnerLeFocus = false): void {
	for (const onglet of onglets) {
		const actif = onglet.dataset.onglet === id;
		onglet.setAttribute('aria-selected', String(actif));
		onglet.tabIndex = actif ? 0 : -1;
		if (actif && donnerLeFocus) onglet.focus();
	}
	for (const panneau of panneaux) {
		panneau.hidden = panneau.dataset.panneau !== id;
	}
}

onglets.forEach((onglet, index) => {
	onglet.addEventListener('click', () => ouvrir(onglet.dataset.onglet ?? ''));

	onglet.addEventListener('keydown', (evenement) => {
		const dernier = onglets.length - 1;
		const cibles: Record<string, number> = {
			ArrowRight: index === dernier ? 0 : index + 1,
			ArrowLeft: index === 0 ? dernier : index - 1,
			Home: 0,
			End: dernier,
		};
		const cible = cibles[evenement.key];
		if (cible === undefined) return;
		evenement.preventDefault();
		ouvrir(onglets[cible]?.dataset.onglet ?? '', true);
	});
});

document.addEventListener('click', (evenement) => {
	const lien = (evenement.target as Element | null)?.closest<HTMLElement>('[data-voir-pole]');
	if (lien?.dataset.voirPole) ouvrir(lien.dataset.voirPole);
});
