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
					"inline-flex cursor-pointer items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground",
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
				"inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
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
