"use client";

import { Fire } from "@phosphor-icons/react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { formatBytes } from "@/lib/format";
import { CopyButton } from "./copy-button";
import { ReportDialog } from "./report-dialog";

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

export function PasteView({ paste, highlightedHtml }: PasteViewProps) {
	// Computed directly — no state/effect needed since this is a client component
	// and window is available at render time.
	const rawUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/text/${paste.id}`
			: `/text/${paste.id}`;

	const lines = paste.content.split("\n");
	const lineCount = lines.length;
	const gutterWidth = String(lineCount).length;

	return (
		<div className="mx-auto w-full max-w-4xl">
			{/* Toolbar — just logo + copy */}
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<a
						href="/"
						className="text-sm font-bold tracking-tight text-foreground transition-colors hover:text-foreground/70"
					>
						just-text
					</a>
					{paste.burnAfterRead && (
						<span className="inline-flex items-center gap-1 rounded-md bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
							<Fire size={12} weight="fill" />
							Burned after reading
						</span>
					)}
				</div>
				<CopyButton text={paste.content} label="Copy" variant="full" />
			</div>

			{/* Content */}
			<div className="rounded-xl border border-border bg-card">
				{paste.format === "code" && highlightedHtml ? (
					<div
						className="overflow-x-auto p-5 text-sm leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
						dangerouslySetInnerHTML={{ __html: highlightedHtml }}
					/>
				) : paste.format === "markdown" ? (
					<div className="prose prose-invert prose-sm max-w-none p-5">
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
							{/* Gutter — same font/line-height as content so rows stay aligned */}
							<div
								className="select-none shrink-0 border-r border-border pr-3 text-right text-muted-foreground/30"
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
							{/* Content — no wrapping, preserves fixed-width formatting */}
							<pre
								className="px-5 text-foreground"
								style={{ whiteSpace: "pre" }}
							>
								{paste.content}
							</pre>
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/50">
				<div className="flex flex-wrap items-center gap-3">
					<span>
						Created {format(new Date(paste.createdAt * 1000), "MMM d, yyyy")}
					</span>
					{paste.expiresAt && (
						<span>
							Expires {format(new Date(paste.expiresAt * 1000), "MMM d, yyyy")}
						</span>
					)}
					<span>{formatBytes(paste.sizeBytes)}</span>
					<span>
						{lineCount} {lineCount === 1 ? "line" : "lines"}
					</span>
					{paste.format === "code" && paste.language && (
						<span>{paste.language}</span>
					)}
					<a
						href={rawUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="transition-colors hover:text-foreground"
					>
						raw
					</a>
				</div>
				<ReportDialog pasteId={paste.id} />
			</div>
		</div>
	);
}
