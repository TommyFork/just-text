"use client";

import { useEffect, useRef, useState } from "react";
import type { PasteFormat } from "@/lib/constants";
import type { RenderRequest, RenderResponse } from "@/workers/render.worker";
import { BurnGate } from "./burn-gate";
import { PasteView } from "./paste-view";

interface PasteData {
	id: string;
	ciphertext: string;
	iv: string;
	format: PasteFormat;
	language?: string;
	createdAt: number;
	expiresAt: number | null;
	burnAfterRead: boolean;
	viewCount: number;
	sizeBytes: number;
}

type PageState =
	| { status: "loading" }
	| { status: "no-key" }
	| { status: "decrypting"; paste: PasteData }
	| { status: "done"; paste: PasteData; html: string; plaintext: string }
	| { status: "error"; message: string };

export function PasteClientPage({ id }: { id: string }) {
	const [state, setState] = useState<PageState>({ status: "loading" });
	const workerRef = useRef<Worker | null>(null);

	useEffect(() => {
		const keyB64url = window.location.hash.slice(1);
		if (!keyB64url) {
			setState({ status: "no-key" });
			return;
		}

		let cancelled = false;

		async function fetchAndDecrypt() {
			const res = await fetch(`/api/paste/${id}`);
			if (!res.ok) {
				if (!cancelled)
					setState({ status: "error", message: "Paste not found or expired" });
				return;
			}

			const paste: PasteData = await res.json();

			// burn-after-read is handled in the server page component via metadata check.
			// If it somehow reaches here, hand off to BurnGate.
			if (paste.burnAfterRead) {
				// Shouldn't normally happen (server routes burn-after-read to BurnGate),
				// but gracefully handle it if it does.
				if (!cancelled)
					setState({ status: "done", paste, html: "", plaintext: "" });
				return;
			}

			if (!cancelled) setState({ status: "decrypting", paste });

			const worker = new Worker(
				new URL("../workers/render.worker.ts", import.meta.url),
			);
			workerRef.current = worker;

			worker.onmessage = (event: MessageEvent<RenderResponse>) => {
				if (cancelled) return;
				if (event.data.type === "success") {
					setState({
						status: "done",
						paste,
						html: event.data.html,
						plaintext: event.data.plaintext,
					});
				} else {
					setState({ status: "error", message: event.data.message });
				}
				worker.terminate();
				workerRef.current = null;
			};

			worker.onerror = (err) => {
				if (cancelled) return;
				setState({ status: "error", message: err.message || "Worker error" });
				worker.terminate();
				workerRef.current = null;
			};

			const req: RenderRequest = {
				type: "render",
				ciphertext: paste.ciphertext,
				iv: paste.iv,
				keyB64url,
				format: paste.format,
				language: paste.language,
			};
			worker.postMessage(req);
		}

		fetchAndDecrypt().catch((err) => {
			if (!cancelled)
				setState({
					status: "error",
					message: err instanceof Error ? err.message : "Failed to load paste",
				});
		});

		return () => {
			cancelled = true;
			workerRef.current?.terminate();
			workerRef.current = null;
		};
	}, [id]);

	if (state.status === "loading" || state.status === "decrypting") {
		return <Skeleton />;
	}

	if (state.status === "no-key") {
		return (
			<div className="mx-auto w-full max-w-4xl">
				<div className="mb-3 flex items-center gap-2">
					<a
						href="/"
						className="text-sm font-bold tracking-tighter transition-colors hover:opacity-70 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
					>
						textdrop.sh
					</a>
				</div>
				<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card p-8 text-center shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
					<p className="text-sm font-medium text-foreground/80">
						No decryption key found
					</p>
					<p className="mt-2 text-xs text-muted-foreground/60">
						This link appears to be incomplete. The decryption key should be in
						the URL after the{" "}
						<code className="rounded bg-white/[0.06] px-1 py-0.5">#</code>{" "}
						symbol.
					</p>
				</div>
			</div>
		);
	}

	if (state.status === "error") {
		return (
			<div className="mx-auto w-full max-w-4xl">
				<div className="mb-3 flex items-center gap-2">
					<a
						href="/"
						className="text-sm font-bold tracking-tighter transition-colors hover:opacity-70 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
					>
						textdrop.sh
					</a>
				</div>
				<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card p-8 text-center shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
					<p className="text-sm font-medium text-destructive">
						Failed to decrypt
					</p>
					<p className="mt-2 text-xs text-muted-foreground/60">
						{state.message}
					</p>
				</div>
			</div>
		);
	}

	const keyB64url = window.location.hash.slice(1);
	return (
		<PasteView
			paste={state.paste}
			html={state.html}
			plaintext={state.plaintext}
			keyB64url={keyB64url}
		/>
	);
}

function Skeleton() {
	return (
		<div className="mx-auto w-full max-w-4xl animate-pulse">
			{/* Toolbar skeleton */}
			<div className="mb-3 flex items-center justify-between">
				<div className="h-4 w-24 rounded-full bg-white/[0.06]" />
				<div className="flex gap-2">
					<div className="h-7 w-16 rounded-full bg-white/[0.06]" />
					<div className="h-7 w-16 rounded-full bg-white/[0.06]" />
					<div className="h-7 w-16 rounded-full bg-white/[0.06]" />
				</div>
			</div>
			{/* Content skeleton */}
			<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
				<div className="space-y-2 p-6">
					{[100, 85, 92, 70, 88, 60, 75].map((w, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton lines are stable
							key={i}
							className="h-3.5 rounded bg-white/[0.05]"
							style={{ width: `${w}%` }}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
