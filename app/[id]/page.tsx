import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PasteView } from "@/components/paste-view";
import { highlightCode } from "@/lib/highlight";
import { getPaste } from "@/lib/paste";

interface PageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { id } = await params;

	return {
		title: `just-text — ${id}`,
		description: "Shared text on just-text",
		openGraph: {
			title: `just-text — ${id}`,
			description: "Shared text on just-text",
		},
		robots: {
			index: false,
			follow: false,
		},
	};
}

export default async function ViewPaste({ params }: PageProps) {
	const { id } = await params;
	const paste = await getPaste(id);

	if (!paste) {
		notFound();
	}

	let highlightedHtml: string | undefined;
	if (paste.format === "code" && paste.language) {
		try {
			highlightedHtml = await highlightCode(paste.content, paste.language);
		} catch {
			// Fall back to plain display
		}
	}

	return (
		<div className="min-h-svh px-4 py-8">
			<PasteView paste={paste} highlightedHtml={highlightedHtml} />
		</div>
	);
}
