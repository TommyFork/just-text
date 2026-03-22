"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PasteFormat } from "@/lib/constants";
import {
	base64urlDecode,
	base64urlEncode,
	deriveKeyFromPassword,
	unwrapDataKey,
} from "@/lib/crypto";
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
	passwordProtected: boolean;
	key?: string;
	salt?: string;
	wrappedKey?: string;
	wrapIv?: string;
}

type PageState =
	| { status: "loading" }
	| { status: "password-required"; paste: PasteData }
	| { status: "decrypting"; paste: PasteData; keyB64url: string }
	| {
			status: "done";
			paste: PasteData;
			html: string;
			plaintext: string;
			keyB64url?: string;
	  }
	| { status: "error"; message: string };

export function PasteClientPage({ id }: { id: string }) {
	const [state, setState] = useState<PageState>({ status: "loading" });
	const [passwordInput, setPasswordInput] = useState("");
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const cancelledRef = useRef(false);

	const decryptPaste = useCallback(
		async (paste: PasteData, keyB64url: string) => {
			cancelledRef.current = false;

			const worker = new Worker(
				new URL("../workers/render.worker.ts", import.meta.url),
				{ type: "module" },
			);
			workerRef.current = worker;

			worker.onmessage = (event: MessageEvent<RenderResponse>) => {
				if (cancelledRef.current) return;
				if (event.data.type === "success") {
					setState({
						status: "done",
						paste,
						html: event.data.html,
						plaintext: event.data.plaintext,
						keyB64url,
					});
				} else {
					setState({ status: "error", message: event.data.message });
				}
				worker.terminate();
				workerRef.current = null;
			};

			worker.onerror = (err) => {
				if (cancelledRef.current) return;
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
		},
		[],
	);

	const handlePasswordSubmit = useCallback(async () => {
		const currentState = state;
		if (currentState.status !== "password-required") return;

		const paste = currentState.paste;
		setPasswordError(null);

		try {
			const saltBytes = base64urlDecode(paste.salt!);
			const key = await deriveKeyFromPassword(passwordInput, saltBytes);
			const dataKey = await unwrapDataKey(
				paste.wrappedKey!,
				paste.wrapIv!,
				key,
			);
			const keyB64url = base64urlEncode(
				await crypto.subtle.exportKey("raw", dataKey),
			);

			setState({ status: "decrypting", paste, keyB64url });
			await decryptPaste(paste, keyB64url);
		} catch {
			setPasswordError("Incorrect password");
		}
	}, [state, passwordInput, decryptPaste]);

	useEffect(() => {
		cancelledRef.current = false;

		async function fetchAndDecrypt() {
			const res = await fetch(`/api/paste/${id}`);
			if (!res.ok) {
				if (!cancelledRef.current)
					setState({ status: "error", message: "Paste not found or expired" });
				return;
			}

			const paste: PasteData = await res.json();

			if (paste.burnAfterRead) {
				if (!cancelledRef.current)
					setState({
						status: "done",
						paste,
						html: "",
						plaintext: "",
					});
				return;
			}

			if (paste.passwordProtected) {
				if (!cancelledRef.current)
					setState({ status: "password-required", paste });
			} else {
				if (!cancelledRef.current)
					setState({ status: "decrypting", paste, keyB64url: paste.key! });
				await decryptPaste(paste, paste.key!);
			}
		}

		fetchAndDecrypt().catch((err) => {
			if (!cancelledRef.current)
				setState({
					status: "error",
					message: err instanceof Error ? err.message : "Failed to load paste",
				});
		});

		return () => {
			cancelledRef.current = true;
			workerRef.current?.terminate();
			workerRef.current = null;
		};
	}, [id, decryptPaste]);

	useEffect(() => {
		if (state.status === "password-required" && passwordInput) {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					handlePasswordSubmit();
				}
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}
	}, [state.status, passwordInput, handlePasswordSubmit]);

	if (state.status === "loading" || state.status === "decrypting") {
		return <Skeleton />;
	}

	if (state.status === "password-required") {
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
					<div className="mb-4 flex justify-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 256 256"
								fill="currentColor"
								className="h-6 w-6 text-orange-400"
							>
								<path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-80-56a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z" />
							</svg>
						</div>
					</div>
					<p className="text-sm font-medium text-foreground/80">
						This paste is password-protected
					</p>
					<p className="mt-2 text-xs text-muted-foreground/60">
						Enter the password to decrypt this paste.
					</p>
					<div className="mt-4 flex flex-col items-center gap-2">
						<input
							type="password"
							value={passwordInput}
							onChange={(e) => setPasswordInput(e.target.value)}
							placeholder="Enter password..."
							className="w-full max-w-xs rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/25 focus:border-orange-500/40 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
							autoFocus
						/>
						{passwordError && (
							<p className="text-xs text-destructive">{passwordError}</p>
						)}
						<button
							type="button"
							onClick={handlePasswordSubmit}
							disabled={!passwordInput}
							className="mt-2 inline-flex h-9 items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-5 text-sm font-medium text-orange-400 transition-all hover:bg-orange-500/20 disabled:pointer-events-none disabled:opacity-50"
						>
							Decrypt
						</button>
					</div>
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

	return (
		<PasteView
			paste={state.paste}
			html={state.html}
			plaintext={state.plaintext}
			keyB64url={state.keyB64url}
		/>
	);
}

function Skeleton() {
	return (
		<div className="mx-auto w-full max-w-4xl animate-pulse">
			<div className="mb-3 flex items-center justify-between">
				<div className="h-4 w-24 rounded-full bg-white/[0.06]" />
				<div className="flex gap-2">
					<div className="h-7 w-16 rounded-full bg-white/[0.06]" />
					<div className="h-7 w-16 rounded-full bg-white/[0.06]" />
					<div className="h-7 w-16 rounded-full bg-white/[0.06]" />
				</div>
			</div>
			<div className="overflow-hidden rounded-xl border border-white/[0.07] bg-card shadow-[0_0_0_1px_oklch(1_0_0/0.03),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
				<div className="space-y-2 p-6">
					{[100, 85, 92, 70, 88, 60, 75].map((w, i) => (
						<div
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
