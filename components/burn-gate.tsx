"use client";

import { Fire } from "@phosphor-icons/react";
import { useState } from "react";
import type { PasteFormat } from "@/lib/constants";
import type { RenderRequest, RenderResponse } from "@/workers/render.worker";
import { PasteView } from "./paste-view";

interface BurnGateProps {
	id: string;
}

interface FetchedPaste {
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

type State =
	| "confirm"
	| "loading"
	| {
			status: "done";
			paste: FetchedPaste;
			html: string;
			plaintext: string;
			keyB64url: string;
	  }
	| "error";

export function BurnGate({ id }: BurnGateProps) {
	const [state, setState] = useState<State>("confirm");
	const [error, setError] = useState<string | null>(null);

	async function handleReveal() {
		setState("loading");

		const keyB64url = window.location.hash.slice(1);
		if (!keyB64url) {
			setError("No decryption key in URL — cannot reveal this paste.");
			setState("error");
			return;
		}

		try {
			// Fetching from this endpoint atomically deletes the paste (burn-after-read).
			const res = await fetch(`/api/paste/${id}`);
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? "Paste not found or already viewed");
			}
			const paste: FetchedPaste = await res.json();

			await new Promise<void>((resolve, reject) => {
				const worker = new Worker(
					new URL("../workers/render.worker.ts", import.meta.url),
				);

				worker.onmessage = (event: MessageEvent<RenderResponse>) => {
					worker.terminate();
					if (event.data.type === "success") {
						// Paste is now consumed — strip the key from the URL bar.
						// The key is stored in state so PasteView can still render it.
						history.replaceState(null, "", window.location.pathname);
						setState({
							status: "done",
							paste,
							html: event.data.html,
							plaintext: event.data.plaintext,
							keyB64url,
						});
						resolve();
					} else {
						reject(new Error(event.data.message));
					}
				};

				worker.onerror = (err) => {
					worker.terminate();
					reject(new Error(err.message || "Worker error"));
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
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setState("error");
		}
	}

	if (typeof state === "object" && state.status === "done") {
		return (
			<PasteView
				paste={state.paste}
				html={state.html}
				plaintext={state.plaintext}
				keyB64url={state.keyB64url}
			/>
		);
	}

	return (
		<div className="mx-auto w-full max-w-4xl">
			{/* Toolbar */}
			<div className="mb-3 flex items-center gap-2">
				<a
					href="/"
					className="text-sm font-bold tracking-tighter transition-colors hover:opacity-70 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent"
				>
					textdrop.sh
				</a>
			</div>

			{/* Gate */}
			<div className="overflow-hidden rounded-xl border border-orange-500/20 bg-orange-500/[0.03] shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
				<div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
					<div className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10">
						<Fire size={28} weight="fill" className="text-orange-400" />
					</div>
					<div>
						<h2 className="text-base font-semibold text-foreground">
							Burn after read
						</h2>
						<p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground/60">
							This paste will be{" "}
							<span className="text-orange-400/80">permanently deleted</span>{" "}
							the moment you view it. This cannot be undone.
						</p>
					</div>

					{state === "error" ? (
						<p className="text-sm text-destructive">{error}</p>
					) : (
						<button
							type="button"
							onClick={handleReveal}
							disabled={state === "loading"}
							className="mt-1 inline-flex h-9 items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-5 text-sm font-medium text-orange-400 transition-all hover:bg-orange-500/20 disabled:pointer-events-none disabled:opacity-50"
						>
							<Fire size={14} weight="fill" />
							{state === "loading" ? "Decrypting..." : "View & burn"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
