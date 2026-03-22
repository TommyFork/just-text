export const MAX_PASTE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_PASTE_SIZE_LABEL = "5MB";
export const DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const ID_LENGTH = 6;

export const EXPIRY_OPTIONS = [
	{ label: "1 hour", value: 3600 },
	{ label: "1 day", value: 86400 },
	{ label: "7 days", value: 604800 },
	{ label: "14 days", value: 1209600 },
	{ label: "30 days", value: 2592000 },
] as const;

export const DEFAULT_EXPIRY_VALUE = 604800; // 7 days

export const FORMAT_OPTIONS = [
	{ label: "Plain Text", value: "plain" },
	{ label: "Markdown", value: "markdown" },
	{ label: "Code", value: "code" },
] as const;

export interface FormatOption {
	label: string;
	value: PasteFormat;
	icon?: React.ComponentType<{ size?: number; weight?: string }>;
}

export type PasteFormat = "plain" | "markdown" | "code";

export const POPULAR_LANGUAGES = [
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
] as const;

export const LANGUAGE_DISPLAY_MAP: Record<string, string> = {
	typescript: "TypeScript",
	javascript: "JavaScript",
	python: "Python",
	rust: "Rust",
	go: "Go",
	java: "Java",
	c: "C",
	cpp: "C++",
	csharp: "C#",
	ruby: "Ruby",
	php: "PHP",
	swift: "Swift",
	kotlin: "Kotlin",
	sql: "SQL",
	html: "HTML",
	css: "CSS",
	json: "JSON",
	yaml: "YAML",
	toml: "TOML",
	bash: "Bash",
	dockerfile: "Dockerfile",
	markdown: "Markdown",
	plaintext: "Plain Text",
};

export function getLanguageDisplayName(lang: string): string {
	return LANGUAGE_DISPLAY_MAP[lang] ?? lang;
}
