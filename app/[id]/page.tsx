import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BurnGate } from "@/components/burn-gate";
import { PasteView } from "@/components/paste-view";
import { highlightCode } from "@/lib/highlight";
import { getPaste, getPasteMetadata } from "@/lib/paste";

interface PageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { id } = await params;

	return {
		title: `textdrop.sh — ${id}`,
		description: "Shared text on textdrop.sh",
		openGraph: {
			title: `textdrop.sh — ${id}`,
			description: "Shared text on textdrop.sh",
		},
		robots: {
			index: false,
			follow: false,
		},
	};
}

export default async function ViewPaste({ params }: PageProps) {
	const { id } = await params;

	const metadata = await getPasteMetadata(id);
	if (!metadata) notFound();

	if (metadata.burnAfterRead) {
		return (
			<div className="min-h-svh px-4 py-4 md:py-8">
				<BurnGate id={id} />
			</div>
		);
	}

	const paste = await getPaste(id);
	if (!paste) notFound();

	let highlightedHtml: string | undefined;
	if (paste.format === "code" && paste.language) {
		try {
			highlightedHtml = await highlightCode(paste.content, paste.language);
		} catch {
			// Fall back to plain display
		}
	}

	return (
		<div className="min-h-svh px-4 py-4 md:py-8">
			<PasteView paste={paste} highlightedHtml={highlightedHtml} />
		</div>
	);
}
