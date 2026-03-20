"use client";

import { ArrowSquareOut, Link, TextT } from "@phosphor-icons/react";
import { format } from "date-fns";
import { formatBytes } from "@/lib/format";
import { CopyButton } from "./copy-button";

interface ShareModalProps {
	id: string;
	expiresAt: number | null;
	sizeBytes: number;
	onCreateAnother: () => void;
}

export function ShareModal({
	id,
	expiresAt,
	sizeBytes,
	onCreateAnother,
}: ShareModalProps) {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
	const styledUrl = `${baseUrl}/${id}`;
	const rawUrl = `${baseUrl}/text/${id}`;

	return (
		<div className="animate-in fade-in slide-in-from-bottom-3 mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
			{/* Header bar */}
			<div className="flex h-10 items-center justify-center border-b border-white/[0.06] bg-white/[0.02] px-4">
				<span className="text-xs text-muted-foreground/50">
					your text is live
				</span>
			</div>

			<div className="p-6">
				<div className="space-y-3">
					<div>
						<label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/50">
							<Link size={11} />
							Styled link
						</label>
						<div className="flex items-center gap-2">
							<code className="flex-1 truncate rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs text-foreground/80">
								{styledUrl}
							</code>
							<a
								href={styledUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
								title="Open in new tab"
							>
								<ArrowSquareOut size={16} />
							</a>
							<CopyButton text={styledUrl} label="Copy styled link" />
						</div>
					</div>

					<div>
						<label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/50">
							<TextT size={11} />
							Raw text
						</label>
						<div className="flex items-center gap-2">
							<code className="flex-1 truncate rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground/50">
								{rawUrl}
							</code>
							<a
								href={rawUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
								title="Open in new tab"
							>
								<ArrowSquareOut size={16} />
							</a>
							<CopyButton text={rawUrl} label="Copy raw link" />
						</div>
					</div>
				</div>

				<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground/35">
					<span>
						{expiresAt
							? `expires ${format(new Date(expiresAt * 1000), "MMM d, yyyy")}`
							: "never expires"}
					</span>
					<span>{formatBytes(sizeBytes)}</span>
				</div>

				<button
					onClick={onCreateAnother}
					className="mt-4 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm font-medium text-foreground/70 transition-all hover:bg-white/[0.07] hover:text-foreground"
				>
					Create another
				</button>
			</div>
		</div>
	);
}
