import nekk from '../assets/marques/nekk.png';
import supportConnecte from '../assets/marques/support-connecte.png';
import teranga from '../assets/marques/teranga-immobilier-blanc.png';
import yeeg from '../assets/marques/yeeg-blanc.png';

/**
 * Marques du bandeau défilant. Les logos y sont passés en noir (filtre CSS) :
 * chaque fichier doit avoir un fond transparent, sinon il devient un rectangle noir.
 * largeur et hauteur : taille d'affichage dans le bandeau, en pixels.
 */
export const marques = [
	{ nom: 'YÉEG', logo: yeeg, largeur: 82, hauteur: 30 },
	{ nom: 'Support Connecté', logo: supportConnecte, largeur: 149, hauteur: 34 },
	{ nom: 'Nëkk', logo: nekk, largeur: 75, hauteur: 46 },
	{ nom: 'Teranga Immobilier', logo: teranga, largeur: 113, hauteur: 34 },
];
