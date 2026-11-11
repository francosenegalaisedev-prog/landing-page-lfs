import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const plan = new URL('/sitemap.xml', site ?? 'https://lafrancosenegalaise.com').href;
	return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${plan}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
