import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BurnGate } from "@/components/burn-gate";
import { PasteClientPage } from "@/components/paste-client-page";
import { getPasteMetadata } from "@/lib/paste";

interface PageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: `textdrop.sh — ${id}`,
		description: "End-to-end encrypted text on textdrop.sh",
		openGraph: {
			title: `textdrop.sh — ${id}`,
			description: "End-to-end encrypted text on textdrop.sh",
		},
		robots: {
			index: false,
			follow: false,
		},
	};
}

export default async function ViewPaste({ params }: PageProps) {
	const { id } = await params;

	// Fetch only non-sensitive metadata (no ciphertext/iv) to gate burn-after-read
	// without consuming the paste. The actual ciphertext is fetched client-side.
	const metadata = await getPasteMetadata(id);
	if (!metadata) notFound();

	return (
		<div className="min-h-svh px-4 py-4 md:py-8">
			{metadata.burnAfterRead ? (
				<BurnGate id={id} />
			) : (
				<PasteClientPage id={id} />
			)}
		</div>
	);
}
