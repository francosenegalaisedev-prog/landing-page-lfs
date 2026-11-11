/** Les quatre pôles de la maison mère, dans l'ordre des onglets. */

export type PoleId = 'marketing' | 'communication' | 'informatique' | 'impression';

export interface BlocPole {
	poleCouleur?: 'marketing' | 'communication' | 'informatique' | 'audiovisuel' | 'impression';
	surtitre: string;
	/** Titre du panneau ; la fin (titreAccent) s'affiche en italique, dans la couleur du pôle. */
	titre: string;
	titreAccent: string;
	texte: string;
}

export interface Pole extends BlocPole {
	id: PoleId;
	numero: string;
	nom: string;
	nomCourt: string;
	services: string[];
	icone: 'courbe' | 'porte-voix' | 'code' | 'camera' | 'phygital';
	/** Sous-pôles affichés dans le même panneau avant la liste commune des services. */
	sousPoles?: BlocPole[];
}

export const poles: Pole[] = [
	{
		id: 'marketing',
		numero: '01',
		nom: 'Marketing & phygital',
		nomCourt: 'Marketing & phygital',
		surtitre: 'Pôle marketing & phygital',
		titre: 'Des décisions fondées, ',
		titreAccent: 'une\u00a0croissance mesurée.',
		texte: 'Positionnement, plateformes de marque et campagnes\u00a0: chaque décision s’appuie sur l’analyse, chaque résultat est mesuré.',
		services: [
			'Positionnement et plateformes de marque',
			'Études et benchmark',
			'Plan marketing',
			'Marketing digital',
			'Campagnes et lancements',
			'Acquisition et fidélisation',
			'Mesure de la performance',
		],
		icone: 'courbe',
	},
	{
		id: 'communication',
		numero: '02',
		nom: 'Communication & audiovisuel',
		nomCourt: 'Communication & audiovisuel',
		surtitre: 'Pôle communication & audiovisuel',
		titre: 'Une marque claire, ',
		titreAccent: 'une\u00a0voix qui porte.',
		texte: 'Nous construisons l’image des marques et des institutions, et la faisons vivre au quotidien, en ligne comme sur le terrain.',
		sousPoles: [
			{
				poleCouleur: 'communication',
				surtitre: 'Communication',
				titre: 'Une marque claire, ',
				titreAccent: 'une\u00a0voix qui porte.',
				texte: 'Nous construisons l’image des marques et des institutions, et la faisons vivre au quotidien, en ligne comme sur le terrain.',
			},
			{
				poleCouleur: 'audiovisuel',
				surtitre: 'Audiovisuel',
				titre: 'Des images qui racontent, ',
				titreAccent: 'des\u00a0vidéos qui marquent.',
				texte: 'De la pré-production à la production finale, nous donnons vie aux marques et aux institutions.',
			},
		],
		services: [
			'Identité de marque et direction artistique',
			'Stratégie de communication',
			'Communication institutionnelle',
			'Community management',
			'Rédaction et contenus',
			'Supports de communication',
			'Films institutionnels',
			'Vidéos de marque',
			'Reportages',
			'Photographie',
			'Formats courts',
			'Motion design',
			'Post-production',
			'Numérisation 3D',
			'Contenus événementiels',
		],
		icone: 'porte-voix',
	},
	{
		id: 'informatique',
		numero: '03',
		nom: 'Pôle informatique',
		nomCourt: 'Pôle informatique',
		surtitre: 'Pôle informatique',
		titre: 'Sites web et applications, ',
		titreAccent: 'de\u00a0l’idée à la maintenance.',
		texte: 'Nous concevons, développons, mettons en ligne et maintenons des sites, des applications et des outils numériques sur mesure.',
		services: [
			'Sites vitrines et e-commerce',
			'Plateformes et portails',
			'Refonte de site',
			'Applications iOS et Android',
			'Applications métier',
			'API et intégrations',
			'Hébergement et domaines',
		],
		icone: 'code',
	},
	{
		id: 'impression',
		numero: '04',
		nom: 'Impression & branding',
		nomCourt: 'Impression & branding',
		surtitre: 'Pôle impression & branding',
		titre: 'Le digital prend forme, ',
		titreAccent: 'en\u00a0vrai.',
		texte: 'Notre atelier imprime et personnalise les supports, de la bâche au mug, et les relie au numérique\u00a0: supports connectés, bornes interactives, espaces de marque.',
		services: [
			'Bâches et kakémonos',
			'Affiches grand format',
			'Textile et goodies',
			'Stickers découpés',
			'Supports connectés NFC et QR',
			'Bornes et écrans interactifs',
			'Expériences immersives',
			'Stands et espaces de marque',
		],
		icone: 'phygital',
	},
];

export function nomDuPole(id: PoleId): string {
	return poles.find((pole) => pole.id === id)?.nomCourt ?? id;
}
