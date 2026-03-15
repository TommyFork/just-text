import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	title: "just-text — Share text. Nothing else.",
	description:
		"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
	),
	openGraph: {
		title: "just-text — Share text. Nothing else.",
		description:
			"Paste text, get a link. Up to 5MB. Syntax highlighting, markdown rendering, raw text access. No account needed.",
		type: "website",
		siteName: "just-text",
	},
	twitter: {
		card: "summary",
		title: "just-text",
		description: "Share text. Nothing else.",
	},
	robots: {
		index: true,
		follow: true,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={cn("dark", jetbrainsMono.variable)}>
			<body className="font-mono antialiased">
				<TooltipProvider>{children}</TooltipProvider>
			</body>
		</html>
	);
}
