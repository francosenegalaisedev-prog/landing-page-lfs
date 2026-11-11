/** Menu mobile (sous 861 px) : ouverture, fermeture au clic sur un lien, à la touche Échap et au passage en grand écran. */

const bouton = document.querySelector<HTMLButtonElement>('[data-menu-bouton]');
const menu = document.getElementById('menu-mobile');

if (bouton && menu) {
	const basculer = (ouvert: boolean): void => {
		bouton.setAttribute('aria-expanded', String(ouvert));
		menu.hidden = !ouvert;
	};

	bouton.addEventListener('click', () => basculer(bouton.getAttribute('aria-expanded') !== 'true'));

	menu.addEventListener('click', (evenement) => {
		if ((evenement.target as Element | null)?.closest('a')) basculer(false);
	});

	document.addEventListener('keydown', (evenement) => {
		if (evenement.key === 'Escape' && !menu.hidden) {
			basculer(false);
			bouton.focus();
		}
	});

	window.matchMedia('(min-width: 861px)').addEventListener('change', (requete) => {
		if (requete.matches) basculer(false);
	});
}
