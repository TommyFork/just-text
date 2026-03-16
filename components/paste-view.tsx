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
	const rawUrl = `/text/${paste.id}`;

	const lines = paste.content.split("\n");
	const lineCount = lines.length;
	const gutterWidth = String(lineCount).length;

	return (
		<div className="mx-auto w-full max-w-4xl">
			{/* Toolbar */}
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<a
						href="/"
						className="text-sm font-bold tracking-tighter transition-colors hover:opacity-70 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
					>
						just-text
					</a>
					{paste.format === "code" && paste.language && (
						<span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs text-muted-foreground/60">
							{paste.language}
						</span>
					)}
					{paste.burnAfterRead && (
						<span className="inline-flex items-center gap-1 rounded bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
							<Fire size={11} weight="fill" />
							burned
						</span>
					)}
				</div>
				<CopyButton text={paste.content} label="Copy" variant="full" />
			</div>

			{/* Content window */}
			<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
				{paste.format === "code" && highlightedHtml ? (
					<div
						className="overflow-x-auto p-5 text-sm leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
						dangerouslySetInnerHTML={{ __html: highlightedHtml }}
					/>
				) : paste.format === "markdown" ? (
					<div className="prose prose-invert prose-sm max-w-none p-6 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/[0.07] [&_code]:text-[0.82em]">
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
			<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/35">
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
					<a
						href={rawUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="transition-colors hover:text-foreground/60"
					>
						raw ↗
					</a>
				</div>
				<ReportDialog pasteId={paste.id} />
			</div>
		</div>
	);
}
