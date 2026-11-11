import type { APIRoute } from 'astro';

const pages = ['/', '/mentions-legales/', '/confidentialite/'];

export const GET: APIRoute = ({ site }) => {
	const base = site ?? new URL('https://lafrancosenegalaise.com');
	const urls = pages.map((page) => `  <url><loc>${new URL(page, base).href}</loc></url>`).join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
