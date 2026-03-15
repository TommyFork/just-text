"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
	text: string;
	label?: string;
	className?: string;
	variant?: "icon" | "full";
}

export function CopyButton({
	text,
	label = "Copy",
	className,
	variant = "icon",
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard access denied — nothing to do
		}
	}

	if (variant === "icon") {
		return (
			<button
				onClick={handleCopy}
				className={cn(
					"inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
					className,
				)}
				title={copied ? "Copied!" : label}
			>
				{copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
			</button>
		);
	}

	return (
		<button
			onClick={handleCopy}
			className={cn(
				"inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-card-foreground transition-colors hover:bg-accent",
				className,
			)}
		>
			{copied ? (
				<>
					<Check size={14} weight="bold" />
					Copied!
				</>
			) : (
				<>
					<Copy size={14} />
					{label}
				</>
			)}
		</button>
	);
}
