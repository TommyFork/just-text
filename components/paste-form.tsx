"use client";

import {
	ArrowRight,
	CaretDown,
	Code,
	Fire,
	MarkdownLogo,
	TextT,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	DEFAULT_EXPIRY_VALUE,
	EXPIRY_OPTIONS,
	FORMAT_OPTIONS,
	MAX_PASTE_SIZE_BYTES,
	type PasteFormat,
	POPULAR_LANGUAGES,
} from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { ShareModal } from "./share-modal";

interface PasteResult {
	id: string;
	expiresAt: number | null;
	sizeBytes: number;
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
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
		setIsMac(/Mac/.test(navigator.userAgent));
	}, []);

	const sizeBytes = new Blob([content]).size;
	const sizeOverLimit = sizeBytes > MAX_PASTE_SIZE_BYTES;

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
			{/* Textarea */}
			<div className="relative">
				<textarea
					ref={textareaRef}
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Paste or type your text here..."
					className="min-h-[400px] w-full resize-y rounded-xl border border-border bg-card px-5 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
					spellCheck={false}
				/>
				{content.length > 0 && (
					<div className="absolute right-3 bottom-3 text-xs text-muted-foreground">
						<span className={sizeOverLimit ? "text-destructive" : ""}>
							{formatBytes(sizeBytes)}
						</span>
						{" / 5 MB"}
					</div>
				)}
			</div>

			{/* Options bar — row 1: format + submit */}
			<div className="mt-3 flex items-center gap-2">
				{/* Format picker */}
				<div className="flex items-center rounded-lg border border-border bg-card">
					{FORMAT_OPTIONS.map((opt) => {
						const Icon =
							opt.value === "plain"
								? TextT
								: opt.value === "markdown"
									? MarkdownLogo
									: Code;
						return (
							<button
								key={opt.value}
								onClick={() => setFormat(opt.value as PasteFormat)}
								className={`inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors ${
									format === opt.value
										? "bg-accent text-accent-foreground"
										: "text-muted-foreground hover:text-foreground"
								} ${opt.value === "plain" ? "rounded-l-lg" : ""} ${opt.value === "code" ? "rounded-r-lg" : ""}`}
							>
								<Icon size={14} />
								{opt.label}
							</button>
						);
					})}
				</div>

				<div className="flex-1" />

				{/* Submit */}
				<button
					onClick={handleSubmit}
					disabled={!content.trim() || loading || sizeOverLimit}
					className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
				>
					{loading ? (
						"Creating..."
					) : (
						<>
							Share
							<ArrowRight size={14} weight="bold" />
						</>
					)}
				</button>
			</div>

			{/* Options bar — row 2: secondary controls */}
			<div className="mt-2 flex flex-wrap items-center gap-2">
				{/* Language picker (only for code) */}
				{format === "code" && (
					<div className="relative flex items-center">
						<select
							value={language}
							onChange={(e) => setLanguage(e.target.value)}
							className="h-8 appearance-none rounded-lg border border-border bg-card pl-3 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						>
							{POPULAR_LANGUAGES.map((lang) => (
								<option key={lang} value={lang}>
									{lang}
								</option>
							))}
						</select>
						<CaretDown
							size={11}
							className="pointer-events-none absolute right-2.5 text-muted-foreground"
						/>
					</div>
				)}

				{/* Expiry picker */}
				<div className="relative flex items-center">
					<select
						value={expirySeconds}
						onChange={(e) => setExpirySeconds(Number(e.target.value))}
						className="h-8 appearance-none rounded-lg border border-border bg-card pl-3 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					>
						{EXPIRY_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
					<CaretDown
						size={11}
						className="pointer-events-none absolute right-2.5 text-muted-foreground"
					/>
				</div>

				{/* Burn after read */}
				<button
					onClick={() => setBurnAfterRead(!burnAfterRead)}
					className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
						burnAfterRead
							? "border-orange-500/50 bg-orange-500/10 text-orange-400"
							: "border-border text-muted-foreground hover:text-foreground"
					}`}
				>
					<Fire size={14} weight={burnAfterRead ? "fill" : "regular"} />
					Burn after read
				</button>
			</div>

			{/* Keyboard hint */}
			<div className="mt-2 text-right text-xs text-muted-foreground/50">
				<kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
					{isMac ? "⌘" : "Ctrl"}
				</kbd>
				{" + "}
				<kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
					Enter
				</kbd>
				{" to share"}
			</div>

			{/* Error */}
			{error && (
				<div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
					{error}
				</div>
			)}
		</div>
	);
}
