import { Metadata } from "next";
import { Footer } from "@/components/footer";
import { PasteForm } from "@/components/paste-form";

export const metadata: Metadata = {
	title: "textdrop.sh — Share text. Nothing else.",
	description:
		"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
	openGraph: {
		title: "textdrop.sh — Share text. Nothing else.",
		description:
			"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
		type: "website",
	},
};

export default function Home() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
			<header className="mb-6 text-center">
				<h1 className="bg-gradient-to-b from-foreground to-foreground/55 bg-clip-text text-2xl font-bold tracking-tighter text-transparent">
					textdrop.sh
				</h1>
			</header>

			<PasteForm />

			<Footer />
		</div>
	);
}
