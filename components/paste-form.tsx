"use client";

import {
	CircleNotch,
	Code,
	Fire,
	MarkdownLogo,
	TextT,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	useCombobox,
} from "@/components/ui/combobox";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import {
	DEFAULT_EXPIRY_VALUE,
	EXPIRY_OPTIONS,
	getLanguageDisplayName,
	LANGUAGE_DISPLAY_MAP,
	MAX_PASTE_SIZE_BYTES,
	type PasteFormat,
	POPULAR_LANGUAGES,
} from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShareModal } from "./share-modal";

const TEXTAREA_HEIGHT_PX = 380;

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

function displayLang(lang: string): string {
	return getLanguageDisplayName(lang);
}

function LanguageList() {
	const { searchQuery } = useCombobox();

	const filteredLanguages = useMemo(() => {
		const query = searchQuery.toLowerCase();
		return (POPULAR_LANGUAGES as readonly string[]).filter((lang) => {
			const displayName = displayLang(lang).toLowerCase();
			return displayName.includes(query) || lang.toLowerCase().includes(query);
		});
	}, [searchQuery]);

	if (filteredLanguages.length === 0) {
		return (
			<ComboboxList>
				<ComboboxEmpty>No languages found</ComboboxEmpty>
			</ComboboxList>
		);
	}

	return (
		<ComboboxList>
			{filteredLanguages.map((lang) => (
				<ComboboxItem key={lang} value={displayLang(lang)}>
					{displayLang(lang)}
				</ComboboxItem>
			))}
		</ComboboxList>
	);
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

	const { sizeBytes, sizeOverLimit, lineCount } = useMemo(() => {
		const sizeBytes = Buffer.byteLength(content, "utf8");
		return {
			sizeBytes,
			sizeOverLimit: sizeBytes > MAX_PASTE_SIZE_BYTES,
			lineCount: content ? content.split("\n").length : 0,
		};
	}, [content]);

	const isSubmitDisabled = !content.trim() || loading || sizeOverLimit;

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
		const textarea = textareaRef.current;
		if (!textarea) return;

		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		}
		textarea.addEventListener("keydown", handleKeyDown);
		return () => textarea.removeEventListener("keydown", handleKeyDown);
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
					<div className="flex items-center justify-between gap-2 px-4 pt-3">
						<div
							ref={tabsRef}
							className="relative inline-flex h-8 items-center gap-0.5 rounded-full bg-white/[0.06] px-0.5 shrink-0"
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
									aria-pressed={format === opt.value}
									className={cn(
										"relative z-10 inline-flex h-6 items-center justify-center gap-1 rounded-full px-2 sm:px-3 text-xs font-medium leading-none transition-colors disabled:pointer-events-none whitespace-nowrap cursor-pointer",
										format === opt.value
											? "text-foreground"
											: "text-muted-foreground hover:text-foreground/80",
									)}
								>
									{opt.icon}
									<span className="hidden sm:inline">{opt.label}</span>
									<span className="sm:hidden">
										{opt.value === "plain"
											? "Text"
											: opt.value === "markdown"
												? "MD"
												: "Code"}
									</span>
								</button>
							))}
						</div>

						{/* Language dropdown with search */}
						{format === "code" && (
							<Combobox
								value={displayLang(language)}
								onValueChange={(value) => {
									const langKey = Object.keys(LANGUAGE_DISPLAY_MAP).find(
										(key) => LANGUAGE_DISPLAY_MAP[key] === value,
									);
									setLanguage(langKey || value.toLowerCase());
								}}
							>
								<ComboboxTrigger className="w-32 sm:w-44 shrink-0 cursor-pointer">
									{displayLang(language)}
								</ComboboxTrigger>
								<ComboboxContent>
									<ComboboxSearch placeholder="Search languages..." />
									<LanguageList />
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
							className="border-0 bg-transparent px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/25 focus-visible:ring-0 focus-visible:ring-offset-0"
							style={{
								height: `${TEXTAREA_HEIGHT_PX}px`,
								maxHeight: `${TEXTAREA_HEIGHT_PX}px`,
								resize: "vertical",
							}}
							spellCheck={false}
							aria-label="Paste content"
						/>
						<div className="sticky bottom-0 h-8 -mt-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
					</div>
				</div>
			</div>

			{/* Controls */}
			<div className="mt-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
				{/* Expiry picker */}
				<Combobox
					value={
						EXPIRY_OPTIONS.find((o) => o.value === expirySeconds)?.label ?? ""
					}
					onValueChange={(label) => {
						const opt = EXPIRY_OPTIONS.find((o) => o.label === label);
						if (opt) setExpirySeconds(opt.value);
					}}
				>
					<ComboboxTrigger className="cursor-pointer">
						{EXPIRY_OPTIONS.find((o) => o.value === expirySeconds)?.label}
					</ComboboxTrigger>
					<ComboboxContent align="start">
						<ComboboxList>
							{EXPIRY_OPTIONS.map((opt) => (
								<ComboboxItem key={opt.value} value={opt.label}>
									{opt.label}
								</ComboboxItem>
							))}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>

				{/* Burn after read */}
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setBurnAfterRead(!burnAfterRead)}
					className={cn(
						"h-8 gap-1.5 rounded-full border px-3 text-xs font-medium transition-all cursor-pointer",
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
							"hidden text-xs tabular-nums text-muted-foreground/35 xs:block",
							sizeOverLimit && "text-destructive",
						)}
					>
						{lineCount} {lineCount === 1 ? "line" : "lines"} &middot;{" "}
						{formatBytes(sizeBytes)}
					</span>
				)}

				{/* Keyboard hint */}
				<div className="hidden items-center gap-0.5 text-xs text-muted-foreground/30 sm:flex">
					<Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
					<span className="mx-0.5 opacity-50">+</span>
					<Kbd>↵</Kbd>
				</div>

				{/* Submit */}
				<Button
					size="sm"
					onClick={handleSubmit}
					disabled={isSubmitDisabled}
					className={cn(
						"h-8 min-w-[4rem] gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-35 disabled:hover:brightness-100 cursor-pointer",
						isSubmitDisabled
							? "shadow-none"
							: "shadow-[0_0_20px_-4px_oklch(0.56_0.23_264/0.65)]",
					)}
				>
					{loading ? (
						<CircleNotch size={13} className="animate-spin" />
					) : (
						"Share"
					)}
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
