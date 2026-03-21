import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { headers } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	title: "textdrop.sh — Share text. Nothing else.",
	description:
		"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
	),
	openGraph: {
		title: "textdrop.sh — Share text. Nothing else.",
		description:
			"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
		type: "website",
		siteName: "textdrop.sh",
	},
	twitter: {
		card: "summary",
		title: "textdrop.sh",
		description: "Share text. Nothing else.",
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Nonce is injected by proxy.ts for the per-request CSP
	const nonce = (await headers()).get("x-nonce") ?? undefined;
	void nonce; // Available for future use with nonce-compatible script components

	return (
		<html lang="en" className={cn("dark", jetbrainsMono.variable)}>
			<body className="font-mono antialiased">
				<TooltipProvider>{children}</TooltipProvider>
				{process.env.NODE_ENV === "production" && (
					<>
						<Analytics />
						<GoogleAnalytics
							gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ?? ""}
						/>
					</>
				)}
			</body>
		</html>
	);
}
