"use client";

import { GithubLogo } from "@phosphor-icons/react";

export function Footer() {
	return (
		<footer className="mt-16 flex flex-col items-center gap-3 text-xs leading-relaxed text-muted-foreground/50">
			<div className="flex items-center gap-4">
				<p>
					No account needed &middot; Up to 5 MB &middot; Syntax highlighting
					&middot; Markdown
				</p>
			</div>
			<div className="flex items-center gap-4">
				<p>
					Raw access via{" "}
					<code className="rounded bg-white/[0.06] px-1 py-0.5 text-muted-foreground/60">
						/text/
					</code>{" "}
					&middot; Keyboard-first
				</p>
				<a
					href="https://github.com/TommyFork/textdrop.sh"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 transition-colors hover:text-foreground/60"
				>
					<GithubLogo size={14} />
					GitHub
				</a>
			</div>
		</footer>
	);
}
