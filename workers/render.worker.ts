/// <reference lib="webworker" />
// Runs in WorkerGlobalScope — no DOM, no React, no Node.js.
// crypto.subtle is available natively in WorkerGlobalScope.

import { base64urlDecode, base64urlEncode } from "@/lib/crypto";

export type RenderRequest = {
	type: "render";
	ciphertext: string; // Base64URL
	iv: string; // Base64URL
	keyB64url: string; // Base64URL AES-256-GCM key
	format: "plain" | "markdown" | "code";
	language?: string;
};

export type RenderResponse =
	| { type: "success"; html: string; plaintext: string }
	| { type: "error"; message: string };

// ── Crypto (inline — avoids importing the full lib/crypto module which uses
//    top-level browser APIs that may not be available at module init in all envs)

async function importKey(keyB64url: string): Promise<CryptoKey> {
	const raw = base64urlDecode(keyB64url);
	return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
		"decrypt",
	]);
}

async function decryptPayload(
	key: CryptoKey,
	ciphertext: string,
	iv: string,
): Promise<string> {
	const ciphertextBytes = base64urlDecode(ciphertext);
	const ivBytes = base64urlDecode(iv);
	const buf = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: ivBytes },
		key,
		ciphertextBytes,
	);
	return new TextDecoder().decode(buf);
}

// ── Renderers ──────────────────────────────────────────────────────────────────

async function renderCode(code: string, lang: string): Promise<string> {
	const { createHighlighter } = await import("shiki");
	const hl = await createHighlighter({
		themes: ["tokyo-night"],
		langs: [lang === "plaintext" ? "text" : lang],
	});
	const loadedLangs = hl.getLoadedLanguages();
	const safeLang = loadedLangs.includes(lang) ? lang : "text";
	return hl.codeToHtml(code, { lang: safeLang, theme: "tokyo-night" });
}

async function renderMarkdown(md: string): Promise<string> {
	// Use the unified pipeline — react-markdown requires DOM/React, incompatible with workers.
	const { unified } = await import("unified");
	const { default: remarkParse } = await import("remark-parse");
	const { default: remarkGfm } = await import("remark-gfm");
	const { default: remarkRehype } = await import("remark-rehype");
	const { default: rehypeSanitize, defaultSchema } = await import(
		"rehype-sanitize"
	);
	const { default: rehypeStringify } = await import("rehype-stringify");

	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype, { allowDangerousHtml: false })
		.use(rehypeSanitize, defaultSchema)
		.use(rehypeStringify)
		.process(md);

	return String(file);
}

function renderPlain(text: string): string {
	// Must HTML-escape before injecting via dangerouslySetInnerHTML
	const escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
	return `<pre class="plain-text">${escaped}</pre>`;
}

// ── Message handler ────────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
	const { type, ciphertext, iv, keyB64url, format, language } = event.data;
	if (type !== "render") return;

	try {
		const key = await importKey(keyB64url);
		const plaintext = await decryptPayload(key, ciphertext, iv);

		let html: string;
		if (format === "code") {
			html = await renderCode(plaintext, language ?? "text");
		} else if (format === "markdown") {
			html = await renderMarkdown(plaintext);
		} else {
			html = renderPlain(plaintext);
		}

		const response: RenderResponse = { type: "success", html, plaintext };
		self.postMessage(response);
	} catch (err) {
		const response: RenderResponse = {
			type: "error",
			message:
				err instanceof Error ? err.message : "Decryption or render failed",
		};
		self.postMessage(response);
	}
};

// Satisfy TypeScript module requirement for worker files
export {};
