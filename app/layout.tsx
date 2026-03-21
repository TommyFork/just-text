import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
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

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={cn("dark", jetbrainsMono.variable)}>
			<head>
				{GA_ID && (
					<>
						<script
							dangerouslySetInnerHTML={{
								__html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
							}}
						/>
						<script
							async
							src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
						/>
					</>
				)}
			</head>
			<body className="font-mono antialiased">
				<TooltipProvider>{children}</TooltipProvider>
				{process.env.NODE_ENV === "production" && <Analytics />}
			</body>
		</html>
	);
}
