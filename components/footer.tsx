"use client";

import { GithubLogo } from "@phosphor-icons/react";

export function Footer() {
	return (
		<footer className="mt-16 flex flex-col items-center gap-3 text-xs leading-relaxed text-muted-foreground/50">
			<p>5 MB max &middot; No account needed</p>
			<a
				href="https://github.com/TommyFork/textdrop.sh"
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 transition-colors hover:text-foreground/60"
			>
				<GithubLogo size={14} />
				GitHub
			</a>
		</footer>
	);
}
