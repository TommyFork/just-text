"use client";

import { Link, TextT } from "@phosphor-icons/react";
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
		<div className="animate-in fade-in slide-in-from-bottom-2 mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
			<h2 className="mb-4 text-lg font-semibold text-foreground">
				Your text is live
			</h2>

			<div className="space-y-3">
				<div>
					<label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
						<Link size={12} />
						Styled link
					</label>
					<div className="flex items-center gap-2">
						<code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
							{styledUrl}
						</code>
						<CopyButton text={styledUrl} label="Copy styled link" />
					</div>
				</div>

				<div>
					<label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
						<TextT size={12} />
						Raw text link
					</label>
					<div className="flex items-center gap-2">
						<code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
							{rawUrl}
						</code>
						<CopyButton text={rawUrl} label="Copy raw link" />
					</div>
				</div>
			</div>

			<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
				<span>
					{expiresAt
						? `Expires ${format(new Date(expiresAt * 1000), "MMM d, yyyy")}`
						: "Never expires"}
				</span>
				<span>{formatBytes(sizeBytes)}</span>
			</div>

			<button
				onClick={onCreateAnother}
				className="mt-4 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
			>
				Create another
			</button>
		</div>
	);
}
