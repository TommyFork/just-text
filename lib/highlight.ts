import {
	type BundledLanguage,
	createHighlighter,
	type Highlighter,
} from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

export async function getHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			themes: ["tokyo-night"],
			langs: [
				"typescript",
				"javascript",
				"python",
				"rust",
				"go",
				"java",
				"c",
				"cpp",
				"csharp",
				"ruby",
				"php",
				"swift",
				"kotlin",
				"sql",
				"html",
				"css",
				"json",
				"yaml",
				"toml",
				"bash",
				"dockerfile",
				"markdown",
				"plaintext",
			],
		});
	}
	return highlighterPromise;
}

function buildTokenStyle(token: {
	color?: string;
	fontStyle?: number;
}): string {
	const styles: string[] = [];
	if (token.color) styles.push(`color:${token.color}`);
	const fs = token.fontStyle as number;
	if (fs & 1) styles.push("font-style:italic");
	if (fs & 2) styles.push("font-weight:bold");
	if (fs & 4) styles.push("text-decoration:underline");
	if (fs & 8) styles.push("text-decoration:line-through");
	return styles.join(";");
}

export async function highlightCode(
	code: string,
	language: string,
): Promise<string> {
	const hl = await getHighlighter();
	const langs = hl.getLoadedLanguages();
	const lang = (
		langs.includes(language) ? language : "plaintext"
	) as BundledLanguage;

	const tokensResult = hl.codeToTokens(code, { lang, theme: "tokyo-night" });
	const gutterWidth = String(tokensResult.tokens.length).length;

	const lines = tokensResult.tokens.map((lineTokens, index) => {
		const tokensHtml = lineTokens
			.map((token) => {
				const style = buildTokenStyle(token);
				return `<span${style ? ` style="${style}"` : ""}>${token.content}</span>`;
			})
			.join("");
		return `<span class="shiki-line"><span class="shiki-ln">${index + 1}</span>${tokensHtml}</span>`;
	});

	return `<pre class="shiki-pre" style="color:${tokensResult.fg};--gutter-width:${gutterWidth}ch" tabindex="0"><code>${lines.join("")}</code></pre>`;
}
