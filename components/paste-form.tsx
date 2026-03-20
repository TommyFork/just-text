"use client";

import { Code, Fire, MarkdownLogo, TextT } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxSearch,
	ComboboxTrigger,
} from "@/components/ui/combobox";
import { Kbd } from "@/components/ui/kbd";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	DEFAULT_EXPIRY_VALUE,
	EXPIRY_OPTIONS,
	MAX_PASTE_SIZE_BYTES,
	type PasteFormat,
	POPULAR_LANGUAGES,
} from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShareModal } from "./share-modal";

interface PasteResult {
	id: string;
	expiresAt: number | null;
	sizeBytes: number;
}

const FORMAT_OPTIONS: {
	value: PasteFormat;
	label: string;
	icon: React.ReactNode;
}[] = [
	{ value: "plain", label: "Plain Text", icon: <TextT size={14} /> },
	{ value: "markdown", label: "Markdown", icon: <MarkdownLogo size={14} /> },
	{ value: "code", label: "Code", icon: <Code size={14} /> },
];

const LANG_DISPLAY: Record<string, string> = {
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

function displayLang(lang: string): string {
	return LANG_DISPLAY[lang] ?? lang;
}

export function PasteForm() {
	const [content, setContent] = useState("");
	const [format, setFormat] = useState<PasteFormat>("plain");
	const [language, setLanguage] = useState("typescript");
	const [expirySeconds, setExpirySeconds] = useState(DEFAULT_EXPIRY_VALUE);
	const [burnAfterRead, setBurnAfterRead] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<PasteResult | null>(null);
	const [isMac, setIsMac] = useState(false);
	const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

	const tabsRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
		setIsMac(/Mac/.test(navigator.userAgent));

		// Pre-fill from fork
		const fork = sessionStorage.getItem("textdrop_fork");
		if (fork) {
			sessionStorage.removeItem("textdrop_fork");
			try {
				const { content: fc, format: ff, language: fl } = JSON.parse(fork);
				if (typeof fc === "string") setContent(fc);
				if (ff === "plain" || ff === "markdown" || ff === "code") setFormat(ff);
				if (typeof fl === "string" && fl) setLanguage(fl);
			} catch {}
		}
	}, []);

	useEffect(() => {
		if (tabsRef.current) {
			const activeIndex = FORMAT_OPTIONS.findIndex(
				(opt) => opt.value === format,
			);
			const buttons = tabsRef.current.querySelectorAll("button");
			const activeButton = buttons[activeIndex];
			if (activeButton) {
				setIndicatorStyle({
					width: activeButton.offsetWidth,
					transform: `translateX(${activeButton.offsetLeft - parseInt(getComputedStyle(tabsRef.current).paddingLeft) || 0}px)`,
				});
			}
		}
	}, [format]);

	const sizeBytes = new Blob([content]).size;
	const sizeOverLimit = sizeBytes > MAX_PASTE_SIZE_BYTES;
	const lineCount = content ? content.split("\n").length : 0;

	const handleSubmit = useCallback(async () => {
		if (!content.trim() || loading || sizeOverLimit) return;

		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/paste", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content,
					format,
					language: format === "code" ? language : undefined,
					expirySeconds,
					burnAfterRead,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error ?? "Failed to create paste");
			}

			const data = await res.json();
			setResult({
				id: data.id,
				expiresAt: data.expiresAt,
				sizeBytes: data.sizeBytes,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}, [
		content,
		format,
		language,
		expirySeconds,
		burnAfterRead,
		loading,
		sizeOverLimit,
	]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleSubmit]);

	if (result) {
		return (
			<ShareModal
				id={result.id}
				expiresAt={result.expiresAt}
				sizeBytes={result.sizeBytes}
				onCreateAnother={() => {
					setResult(null);
					setContent("");
					setTimeout(() => textareaRef.current?.focus(), 0);
				}}
			/>
		);
	}

	return (
		<div className="mx-auto w-full max-w-3xl">
			{/* Editor window */}
			<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7),0_0_0_1px_oklch(0_0_0/0.3)inset]">
				{/* Format tabs - no border, floating style */}
				<div className="relative">
					<div className="flex items-center justify-between px-4 pt-3">
						<div
							ref={tabsRef}
							className="relative inline-flex h-8 items-center gap-0.5 rounded-full bg-white/[0.06] px-0.5"
						>
							<div
								className="absolute inset-y-[2px] rounded-full bg-white/[0.12] shadow-sm transition-all duration-200 ease-out"
								style={indicatorStyle}
							/>
							{FORMAT_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setFormat(opt.value)}
									disabled={loading}
									className={cn(
										"relative z-10 inline-flex h-6 items-center justify-center gap-1 rounded-full px-3 text-xs font-medium transition-colors disabled:pointer-events-none",
										format === opt.value
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground/80",
									)}
								>
									{opt.icon}
									{opt.label}
								</button>
							))}
						</div>

						{/* Language dropdown with search */}
						{format === "code" && (
							<Combobox
								value={displayLang(language)}
								onValueChange={(value) => {
									const langKey = Object.keys(LANG_DISPLAY).find(
										(key) => LANG_DISPLAY[key] === value,
									);
									setLanguage(langKey || value.toLowerCase());
								}}
							>
								<ComboboxTrigger className="w-32">
									{displayLang(language)}
								</ComboboxTrigger>
								<ComboboxContent>
									<ComboboxSearch placeholder="Search languages..." />
									<ComboboxList>
										{(POPULAR_LANGUAGES as readonly string[]).map((lang) => (
											<ComboboxItem key={lang} value={displayLang(lang)}>
												{displayLang(lang)}
											</ComboboxItem>
										))}
									</ComboboxList>
								</ComboboxContent>
							</Combobox>
						)}
					</div>
				</div>

				{/* Textarea with fade */}
				<div className="relative">
					<div className="max-h-[380px] overflow-y-auto">
						<div className="sticky top-0 h-8 -mb-8 bg-gradient-to-b from-card to-transparent pointer-events-none z-10" />
						<Textarea
							ref={textareaRef}
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Paste or type your text here..."
							className="h-[380px] max-h-[380px] resize-y border-0 bg-transparent px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/25 focus-visible:ring-0 focus-visible:ring-offset-0"
							spellCheck={false}
						/>
						<div className="sticky bottom-0 h-8 -mt-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
					</div>
				</div>
			</div>

			{/* Controls */}
			<div className="mt-3 flex items-center gap-2">
				{/* Expiry picker */}
				<Select
					value={String(expirySeconds)}
					onValueChange={(v) => setExpirySeconds(Number(v))}
				>
					<SelectTrigger className="h-8 w-auto bg-white/[0.04] border-white/[0.08] text-xs text-muted-foreground hover:bg-white/[0.06] [&>span]:truncate">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="bg-card border-white/[0.07]">
						{EXPIRY_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={String(opt.value)}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Burn after read */}
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setBurnAfterRead(!burnAfterRead)}
					className={cn(
						"h-8 gap-1.5 rounded-full border px-3 text-xs font-medium transition-all",
						burnAfterRead
							? "border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15 hover:text-orange-400"
							: "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
					)}
				>
					<Fire size={13} weight={burnAfterRead ? "fill" : "regular"} />
					Burn after read
				</Button>

				<div className="flex-1" />

				{/* Size / line count */}
				{content.length > 0 && (
					<span
						className={cn(
							"text-xs tabular-nums text-muted-foreground/35",
							sizeOverLimit && "text-destructive",
						)}
					>
						{lineCount} {lineCount === 1 ? "line" : "lines"} &middot;{" "}
						{formatBytes(sizeBytes)}
					</span>
				)}

				{/* Keyboard hint */}
				<div className="flex items-center gap-0.5 text-xs text-muted-foreground/30">
					<Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
					<span className="mx-0.5 opacity-50">+</span>
					<Kbd>↵</Kbd>
				</div>

				{/* Submit */}
				<Button
					size="sm"
					onClick={handleSubmit}
					disabled={!content.trim() || loading || sizeOverLimit}
					className={cn(
						"h-8 gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-35 disabled:hover:brightness-100",
						!content.trim() || loading || sizeOverLimit
							? "shadow-none"
							: "shadow-[0_0_20px_-4px_oklch(0.56_0.23_264/0.65)]",
					)}
				>
					{loading ? "Sharing..." : "Share"}
				</Button>
			</div>

			{/* Error */}
			{error && (
				<Alert variant="destructive" className="mt-3">
					{error}
				</Alert>
			)}
		</div>
	);
}
