import { createHighlighter, type Highlighter } from "shiki";

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

export async function highlightCode(
	code: string,
	language: string,
): Promise<string> {
	const hl = await getHighlighter();
	const langs = hl.getLoadedLanguages();
	const lang = langs.includes(language) ? language : "plaintext";

	return hl.codeToHtml(code, {
		lang,
		theme: "tokyo-night",
	});
}
