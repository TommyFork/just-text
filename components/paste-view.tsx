"use client";

import {
	DotsThree,
	Fire,
	GitFork,
	GithubLogo,
	Terminal,
	TextT,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
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
import { formatDate, getBaseUrl } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { SharePopover } from "./share-popover";

interface PasteViewProps {
	paste: {
		id: string;
		format: "plain" | "markdown" | "code";
		language?: string;
		createdAt: number;
		expiresAt: number | null;
		burnAfterRead: boolean;
		viewCount: number;
		sizeBytes: number;
	};
	/** Sanitized HTML produced by the render worker */
	html: string;
	/** Decrypted plaintext — used for copy, fork, and line count */
	plaintext: string;
	/** Base64URL key from URL hash — used to construct share links */
	keyB64url: string;
}

function buildCliCommand(
	id: string,
	keyB64url: string,
	baseUrl: string,
): string {
	return `node -e "
const {createDecipheriv}=require('node:crypto');
const id='${id}',key=Buffer.from('${keyB64url}','base64url');
fetch('${baseUrl}/api/paste/'+id)
  .then(r=>r.json())
  .then(({ciphertext,iv})=>{
    const ivBuf=Buffer.from(iv,'base64url');
    const ctBuf=Buffer.from(ciphertext,'base64url');
    const tag=ctBuf.subarray(ctBuf.length-16);
    const ct=ctBuf.subarray(0,ctBuf.length-16);
    const d=createDecipheriv('aes-256-gcm',key,ivBuf);
    d.setAuthTag(tag);
    process.stdout.write(Buffer.concat([d.update(ct),d.final()]).toString('utf8'));
  });"`;
}

function forkPaste(
	paste: PasteViewProps["paste"],
	plaintext: string,
	router: ReturnType<typeof useRouter>,
) {
	try {
		sessionStorage.setItem(
			"textdrop_fork",
			JSON.stringify({
				content: plaintext,
				format: paste.format,
				language: paste.language,
			}),
		);
		router.push("/");
	} catch {
		router.push("/");
	}
}

export function PasteView({
	paste,
	html,
	plaintext,
	keyB64url,
}: PasteViewProps) {
	const router = useRouter();
	const rawUrl = `/text/${paste.id}`;
	const baseUrl = getBaseUrl();
	const cliCommand = buildCliCommand(paste.id, keyB64url, baseUrl);

	const { lines, lineCount, gutterWidth } = useMemo(() => {
		const lines = plaintext.split("\n");
		const lineCount = lines.length;
		const gutterWidth = String(lineCount).length;
		return { lines, lineCount, gutterWidth };
	}, [plaintext]);

	return (
		<div className="mx-auto w-full max-w-4xl">
			{/* Toolbar */}
			<div className="mb-3 flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<a
						href="/"
						className="shrink-0 text-sm font-bold tracking-tighter transition-colors hover:opacity-70 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
					>
						textdrop.sh
					</a>
					{paste.format === "code" && paste.language && (
						<Badge variant="secondary" className="shrink-0 text-xs">
							{paste.language}
						</Badge>
					)}
					{paste.burnAfterRead && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge className="shrink-0 cursor-default border-orange-500/40 bg-orange-500/10 text-orange-400">
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
							title="Open raw ciphertext"
						>
							<TextT size={13} />
							Raw
						</a>
					)}
					<CopyButton text={plaintext} label="Copy" variant="full" />
					{!paste.burnAfterRead && (
						<button
							type="button"
							onClick={() => forkPaste(paste, plaintext, router)}
							className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
							title="Fork this paste"
						>
							<GitFork size={13} />
							Fork
						</button>
					)}
					{!paste.burnAfterRead && (
						<CopyButton
							text={cliCommand}
							label={
								<span className="flex items-center gap-1.5">
									<Terminal size={13} />
									CLI
								</span>
							}
							variant="full"
							title="Copy Node.js decrypt command"
						/>
					)}
					{!paste.burnAfterRead && (
						<SharePopover id={paste.id} keyB64url={keyB64url} />
					)}
				</div>

				{/* Mobile actions */}
				<div className="flex shrink-0 items-center gap-2 sm:hidden">
					<CopyButton text={plaintext} label="Copy" variant="full" />
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
										Raw
									</a>
									<button
										type="button"
										onClick={() => forkPaste(paste, plaintext, router)}
										className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
									>
										<GitFork size={14} />
										Fork
									</button>
									<CopyButton
										text={cliCommand}
										label={
											<span className="flex items-center gap-2.5">
												<Terminal size={14} />
												CLI command
											</span>
										}
										variant="full"
										className="flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
									/>
									<SharePopover
										id={paste.id}
										keyB64url={keyB64url}
										mobileInline
									/>
								</div>
							</PopoverContent>
						</Popover>
					)}
				</div>
			</div>

			{/* Content window */}
			<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
				{paste.format === "code" ? (
					<>
						<div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
							{paste.language && (
								<span className="font-mono text-xs text-muted-foreground/50">
									{paste.language}
								</span>
							)}
							<span className="tabular-nums text-xs text-muted-foreground/30">
								{lineCount} {lineCount === 1 ? "line" : "lines"}
							</span>
						</div>
						<div
							className="shiki-wrapper"
							dangerouslySetInnerHTML={{ __html: html }}
						/>
					</>
				) : paste.format === "markdown" ? (
					<div
						className="prose prose-sm prose-invert max-w-none p-4 sm:prose-base sm:p-7 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-[1.5em] prose-h2:text-[1.2em] prose-h3:text-[1.05em] prose-p:leading-[1.8] prose-a:text-blue-400 prose-a:font-normal prose-a:no-underline prose-strong:text-foreground/90 prose-em:text-foreground/80 prose-code:text-[0.82em] prose-code:font-mono prose-code:font-normal prose-code:bg-white/[0.09] prose-code:px-[0.4em] prose-code:py-[0.18em] prose-code:rounded-md prose-code:text-sky-300/80 prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:bg-[oklch(0.13_0_0)] prose-pre:border prose-pre:border-white/[0.07] prose-pre:shadow-[0_8px_32px_-8px_oklch(0_0_0/0.5)] prose-pre:overflow-x-auto prose-pre:my-4 prose-blockquote:border-l-[3px] prose-blockquote:border-primary/60 prose-blockquote:bg-primary/[0.04] prose-blockquote:rounded-r-lg prose-blockquote:py-0.5 prose-blockquote:px-5 prose-blockquote:my-4 prose-blockquote:text-muted-foreground/80 prose-hr:border-white/[0.07] prose-hr:my-6 prose-table:text-sm prose-table:w-full prose-thead:border-b prose-thead:border-white/[0.1] prose-th:py-2 prose-th:px-3 prose-th:font-medium prose-th:text-muted-foreground/60 prose-td:py-2 prose-td:px-3 prose-tr:border-b prose-tr:border-white/[0.05] prose-img:rounded-xl prose-img:border prose-img:border-white/[0.07] prose-ul:my-3 prose-ol:my-3 prose-li:my-1 [&_a:hover]:underline [&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:px-4 [&_pre_code]:py-3.5 [&_pre_code]:leading-relaxed [&_pre_code]:text-foreground/80 [&_blockquote_p]:my-2 [&_h2]:border-b [&_h2]:border-white/[0.07] [&_h2]:pb-2 [&_thead]:bg-white/[0.03] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
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
							{/* Content — plain text is pre-escaped in the worker, safe to use directly */}
							<pre
								className="px-5 text-foreground/90"
								style={{ whiteSpace: "pre" }}
							>
								{plaintext}
							</pre>
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="relative mt-4 text-center text-xs text-muted-foreground/35">
				<p>
					{formatDate(paste.createdAt)}
					{paste.expiresAt && (
						<> &middot; expires {formatDate(paste.expiresAt)}</>
					)}{" "}
					&middot; {formatBytes(paste.sizeBytes)} &middot; {lineCount}{" "}
					{lineCount === 1 ? "line" : "lines"} &middot;{" "}
					<a
						href="https://github.com/TommyFork/textdrop.sh"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 transition-colors hover:text-foreground/70"
					>
						<GithubLogo size={14} />
						GitHub
					</a>
				</p>
			</div>
		</div>
	);
}
