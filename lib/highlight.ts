import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

export async function getHighlighter(): Promise<Highlighter> {
	if (!highlighter) {
		highlighter = await createHighlighter({
			themes: ["vitesse-dark"],
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
	return highlighter;
}

export async function highlightCode(
	code: string,
	language: string,
): Promise<string> {
	const hl = await getHighlighter();
	const langs = hl.getLoadedLanguages();
	const lang = langs.includes(language) ? language : "plaintext";

	return hl.codeToHtml(code, {
		lang,
		theme: "vitesse-dark",
	});
}
