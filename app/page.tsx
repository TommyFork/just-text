import { Metadata } from "next";
import { PasteForm } from "@/components/paste-form";

export const metadata: Metadata = {
	title: "just-text — Share text. Nothing else.",
	description:
		"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
	openGraph: {
		title: "just-text — Share text. Nothing else.",
		description:
			"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
		type: "website",
	},
};

export default function Home() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
			<header className="mb-10 text-center">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">
					just-text
				</h1>
				<p className="mt-1.5 text-sm text-muted-foreground">
					Share text. Nothing else.
				</p>
			</header>

			<PasteForm />

			<footer className="mt-16 text-center text-xs leading-relaxed text-muted-foreground/40">
				<p>
					No account needed &middot; Up to 5 MB &middot; Syntax highlighting
					&middot; Markdown rendering
				</p>
				<p className="mt-1">
					Every link has a{" "}
					<code className="rounded bg-accent px-1 py-0.5 text-accent-foreground">
						/text/
					</code>{" "}
					raw version &middot; Keyboard-first
				</p>
			</footer>
		</div>
	);
}
