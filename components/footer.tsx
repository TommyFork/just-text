"use client";

import { GithubLogo } from "@phosphor-icons/react";

export function Footer() {
	return (
		<footer className="mt-12 md:mt-16 text-xs text-muted-foreground/50">
			<p className="text-center">
				<a
					href="https://github.com/TommyFork/textdrop.sh"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 transition-colors hover:text-foreground/60"
				>
					<GithubLogo size={14} />
					GitHub
				</a>
			</p>
		</footer>
	);
}
