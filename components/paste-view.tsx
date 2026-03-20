"use client";

import {
	DotsThree,
	Fire,
	GitFork,
	GithubLogo,
	TextT,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { SharePopover } from "./share-popover";

interface PasteViewProps {
	paste: {
		id: string;
		content: string;
		format: "plain" | "markdown" | "code";
		language?: string;
		createdAt: number;
		expiresAt: number | null;
		burnAfterRead: boolean;
		viewCount: number;
		sizeBytes: number;
	};
	highlightedHtml?: string;
}

function forkPaste(paste: PasteViewProps["paste"]) {
	sessionStorage.setItem(
		"textdrop_fork",
		JSON.stringify({
			content: paste.content,
			format: paste.format,
			language: paste.language,
		}),
	);
	window.location.href = "/";
}

export function PasteView({ paste, highlightedHtml }: PasteViewProps) {
	const rawUrl = `/text/${paste.id}`;

	const lines = paste.content.split("\n");
	const lineCount = lines.length;
	const gutterWidth = String(lineCount).length;

	return (
		<div className="mx-auto w-full max-w-4xl">
			{/* Toolbar */}
			<div className="mb-3 flex items-center justify-between gap-2">
				<div className="flex items-center gap-3">
					<a
						href="/"
						className="text-sm font-bold tracking-tighter transition-colors hover:opacity-70 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
					>
						textdrop.sh
					</a>
					{paste.format === "code" && paste.language && (
						<Badge variant="secondary" className="text-xs">
							{paste.language}
						</Badge>
					)}
					{paste.burnAfterRead && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge className="cursor-default border-orange-500/40 bg-orange-500/10 text-orange-400">
									<Fire size={11} weight="fill" />
									<span className="ml-1">burned</span>
								</Badge>
							</TooltipTrigger>
							<TooltipContent>
								This paste has been permanently deleted
							</TooltipContent>
						</Tooltip>
					)}
				</div>
				{/* Desktop actions */}
				<div className="hidden items-center gap-2 sm:flex">
					{!paste.burnAfterRead && (
						<a
							href={rawUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							title="Open raw text"
						>
							<TextT size={13} />
							Raw
						</a>
					)}
					<CopyButton text={paste.content} label="Copy" variant="full" />
					{!paste.burnAfterRead && (
						<button
							type="button"
							onClick={() => forkPaste(paste)}
							className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							title="Fork this paste"
						>
							<GitFork size={13} />
							Fork
						</button>
					)}
					{!paste.burnAfterRead && <SharePopover id={paste.id} />}
				</div>

				{/* Mobile actions */}
				<div className="flex items-center gap-2 sm:hidden">
					<CopyButton text={paste.content} label="Copy" variant="full" />
					{!paste.burnAfterRead && (
						<Popover>
							<PopoverTrigger asChild>
								<button
									type="button"
									className="inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 text-muted-foreground transition-colors hover:text-foreground"
									title="More options"
								>
									<DotsThree size={16} weight="bold" />
								</button>
							</PopoverTrigger>
							<PopoverContent
								className="w-44 border-white/[0.07] bg-card p-1.5"
								align="end"
								sideOffset={4}
							>
								<div className="flex flex-col gap-0.5">
									<a
										href={rawUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
									>
										<TextT size={14} />
										Raw text
									</a>
									<button
										type="button"
										onClick={() => forkPaste(paste)}
										className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
									>
										<GitFork size={14} />
										Fork
									</button>
									<SharePopover id={paste.id} mobileInline />
								</div>
							</PopoverContent>
						</Popover>
					)}
				</div>
			</div>

			{/* Content window */}
			<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
				{paste.format === "code" && highlightedHtml ? (
					<div
						className="overflow-x-auto p-5 text-sm leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
						dangerouslySetInnerHTML={{ __html: highlightedHtml }}
					/>
				) : paste.format === "markdown" ? (
					<div className="prose prose-invert prose-headings:font-semibold prose-pre:rounded-lg prose-pre:bg-white/[0.03] prose-pre:border prose-pre:border-white/[0.07] prose-pre:shadow-lg prose-code:text-[0.875em] prose-code:bg-white/[0.05] prose-code:px-[0.35em] prose-code:py-[0.15em] prose-code:rounded prose-code:before:content-none prose-code:after:content-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-blockquote:border-l-orange-500/50 prose-blockquote:text-muted-foreground prose-hr:border-white/[0.07] max-w-none p-6">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeSanitize]}
						>
							{paste.content}
						</ReactMarkdown>
					</div>
				) : (
					<div className="overflow-x-auto">
						<div className="flex py-5 text-sm leading-relaxed">
							{/* Gutter */}
							<div
								className="select-none shrink-0 border-r border-white/[0.05] pr-4 text-right font-mono text-muted-foreground/20"
								style={{
									paddingLeft: "1.25rem",
									minWidth: `${gutterWidth + 3}ch`,
								}}
								aria-hidden="true"
							>
								{lines.map((_, i) => (
									<div key={i}>{i + 1}</div>
								))}
							</div>
							{/* Content */}
							<pre
								className="px-5 text-foreground/90"
								style={{ whiteSpace: "pre" }}
							>
								{paste.content}
							</pre>
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/35">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span>{format(new Date(paste.createdAt * 1000), "MMM d, yyyy")}</span>
					{paste.expiresAt && (
						<span>
							expires {format(new Date(paste.expiresAt * 1000), "MMM d, yyyy")}
						</span>
					)}
					<span>{formatBytes(paste.sizeBytes)}</span>
					<span>
						{lineCount} {lineCount === 1 ? "line" : "lines"}
					</span>
				</div>
				<a
					href="https://github.com/TommyFork/textdrop.sh"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-xs text-muted-foreground/50 transition-colors hover:text-foreground/70"
				>
					<GithubLogo size={14} />
					GitHub
				</a>
			</div>
		</div>
	);
}
