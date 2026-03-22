/// <reference lib="webworker" />
// Runs in WorkerGlobalScope — no DOM, no React, no Node.js.
// crypto.subtle is available natively in WorkerGlobalScope.

import { marked } from "marked";
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

// Import crypto functions from shared module
import { decrypt, importKey } from "@/lib/crypto";

// ── Renderers ──────────────────────────────────────────────────────────────────

// Memory limit: 10MB for code rendering
const MAX_CODE_SIZE = 10 * 1024 * 1024;

async function renderCode(code: string, lang: string): Promise<string> {
	// Check size limit
	if (code.length > MAX_CODE_SIZE) {
		throw new Error(`Code too large (${code.length} bytes). Maximum: 10MB`);
	}

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
	const html = await marked.parse(md, { async: true, gfm: true });
	return `<div class="markdown-body">${html}</div>`;
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
		const plaintext = await decrypt(key, ciphertext, iv);

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
