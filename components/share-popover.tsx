"use client";

import { Link } from "@phosphor-icons/react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getBaseUrl } from "@/lib/utils";
import { CopyButton } from "./copy-button";

interface SharePopoverProps {
	id: string;
	/** Render as a flat menu item (no nested popover) for use inside mobile menus */
	mobileInline?: boolean;
}

export function SharePopover({ id, mobileInline }: SharePopoverProps) {
	const baseUrl = getBaseUrl();
	const url = `${baseUrl}/${id}`;

	if (mobileInline) {
		return (
			<>
				<div className="my-0.5 border-t border-white/[0.06]" />
				<div className="px-2.5 py-2">
					<p className="mb-1.5 text-xs text-muted-foreground/40">Share</p>
					<div className="flex items-center gap-2">
						<div className="flex items-center gap-1.5 min-w-0 flex-1">
							<Link size={11} className="shrink-0 text-muted-foreground/40" />
							<code className="truncate text-xs text-foreground/60">{url}</code>
						</div>
						<CopyButton text={url} label="Copy link" />
					</div>
				</div>
			</>
		);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
				>
					<Link size={14} />
					Share
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-80 border-white/[0.07] bg-card p-4"
				align="end"
				sideOffset={4}
			>
				<div className="mb-3 flex items-center justify-between">
					<span className="text-xs font-medium text-muted-foreground">
						Share link
					</span>
				</div>
				<div className="flex items-center gap-2">
					<code className="flex-1 truncate rounded border border-white/[0.07] bg-white/[0.04] px-2 py-1.5 text-xs text-foreground/80">
						{url}
					</code>
					<CopyButton text={url} label="Copy link" />
				</div>
			</PopoverContent>
		</Popover>
	);
}
