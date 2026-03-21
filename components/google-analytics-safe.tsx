import Script from "next/script";

interface Props {
	gaId: string;
	nonce?: string;
}

// Initialises GA4 without sending the URL hash fragment to Google.
// The hash holds the E2EE decryption key — it must never reach third-party servers.
//
// Approach:
//   1. Suppress the automatic pageview (send_page_view: false) so gtag.js never
//      reads document.location (which includes the hash).
//   2. Manually fire a page_view event using only origin + pathname.
export function GoogleAnalyticsSafe({ gaId, nonce }: Props) {
	if (!gaId) return null;

	// Safe: gaId is a build-time env var, not user input.
	const initScript = [
		"window.dataLayer=window.dataLayer||[];",
		"function gtag(){dataLayer.push(arguments)}",
		"gtag('js',new Date());",
		`gtag('config','${gaId}',{send_page_view:false});`,
		"gtag('event','page_view',{page_location:location.origin+location.pathname,page_path:location.pathname});",
	].join("");

	return (
		<>
			<Script
				src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
				strategy="afterInteractive"
				nonce={nonce}
			/>
			<script nonce={nonce} dangerouslySetInnerHTML={{ __html: initScript }} />
		</>
	);
}
