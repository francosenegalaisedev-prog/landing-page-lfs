// @ts-check
import fs from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

/** Charge .env.local dans process.env en développement local pour exécuter api/* sous npm run dev. */
function chargerEnvLocal() {
	try {
		const texte = fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
		for (const ligne of texte.split(/\r?\n/)) {
			const propre = ligne.trim();
			if (!propre || propre.startsWith('#')) continue;
			const egal = propre.indexOf('=');
			if (egal <= 0) continue;
			const cle = propre.slice(0, egal).trim();
			const valeur = propre.slice(egal + 1).trim();
			if (valeur) process.env[cle] = valeur;
		}
	} catch {
		// .env.local absent
	}
}

// https://astro.build/config
export default defineConfig({
	// Domaine du site : à confirmer avant la mise en ligne (sert aux URL canoniques,
	// à l'image de partage, au sitemap et au robots.txt).
	site: 'https://lafrancosenegalaise.com',
	vite: {
		plugins: [
			tailwindcss(),
			{
				name: 'fonctions-api-dev',
				apply: 'serve',
				configureServer(server) {
					return () => {
						server.middlewares.stack.unshift({
							route: '',
							handle: async (req, res, next) => {
								const url = req.url?.split('?')[0];
								if (req.method !== 'POST' || (url !== '/api/contact' && url !== '/api/newsletter')) {
									next();
									return;
								}
								try {
									chargerEnvLocal();
									const morceaux = [];
									for await (const m of req) morceaux.push(Buffer.isBuffer(m) ? m : Buffer.from(m));
									const corps = Buffer.concat(morceaux);
									const headers = new Headers();
									for (const [k, v] of Object.entries(req.headers)) {
										if (typeof v === 'string') headers.set(k, v);
										else if (Array.isArray(v)) headers.set(k, v.join(', '));
									}
									const request = new Request(`http://${req.headers.host || 'localhost:4321'}${req.url}`, {
										method: 'POST',
										headers,
										body: corps,
									});
									const fichier = url === '/api/contact' ? './api/contact.ts' : './api/newsletter.ts';
									const moduleFonction = await server.ssrLoadModule(fichier);
									const reponse = await moduleFonction.POST(request);
									res.statusCode = reponse.status;
									reponse.headers.forEach((valeur, cle) => res.setHeader(cle, valeur));
									const buffer = Buffer.from(await reponse.arrayBuffer());
									res.end(buffer);
								} catch (err) {
									console.error('[dev-api]', err);
									res.statusCode = 500;
									res.setHeader('content-type', 'application/json');
									res.end(JSON.stringify({ ok: false }));
								}
							},
						});
					};
				},
			},
		],
	},
});
