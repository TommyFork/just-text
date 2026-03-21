"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const COPY_FEEDBACK_DURATION_MS = 2000;

interface CopyButtonProps {
	text: string;
	label?: React.ReactNode;
	className?: string;
	variant?: "icon" | "full";
	title?: string;
}

export function CopyButton({
	text,
	label = "Copy",
	className,
	variant = "icon",
	title,
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			timeoutRef.current = setTimeout(
				() => setCopied(false),
				COPY_FEEDBACK_DURATION_MS,
			);
		} catch {
			// Clipboard access denied — nothing to do
		}
	}

	const ariaLabel = copied
		? "Copied!"
		: (title ?? (typeof label === "string" ? label : "Copy"));

	if (variant === "icon") {
		return (
			<button
				onClick={handleCopy}
				className={cn(
					"inline-flex cursor-pointer items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground",
					className,
				)}
				title={ariaLabel}
				aria-label={ariaLabel}
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
			aria-label={ariaLabel}
			title={title}
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
