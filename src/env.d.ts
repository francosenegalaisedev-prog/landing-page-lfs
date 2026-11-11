interface ImportMetaEnv {
	readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
	readonly PUBLIC_DEMO?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
