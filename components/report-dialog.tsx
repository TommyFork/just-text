"use client";

import { Flag, X } from "@phosphor-icons/react";
import { useState } from "react";

interface ReportDialogProps {
	pasteId: string;
}

export function ReportDialog({ pasteId }: ReportDialogProps) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
		"idle",
	);

	function handleClose() {
		setOpen(false);
		setStatus("idle");
		setReason("");
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setStatus("sending");

		try {
			const res = await fetch("/api/report", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: pasteId, reason }),
			});

			if (!res.ok) throw new Error();
			setStatus("sent");
		} catch {
			setStatus("error");
		}
	}

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
				title="Report abuse"
			>
				<Flag size={12} />
				Report
			</button>
		);
	}

	return (
		<div className="animate-in fade-in w-full max-w-sm rounded-lg border border-border bg-card p-4">
			<div className="mb-3 flex items-center justify-between">
				<span className="text-sm font-medium text-foreground">
					Report abuse
				</span>
				<button
					onClick={handleClose}
					className="text-muted-foreground hover:text-foreground"
				>
					<X size={14} />
				</button>
			</div>

			{status === "sent" ? (
				<p className="text-sm text-muted-foreground">
					Report submitted. Thank you.
				</p>
			) : (
				<form onSubmit={handleSubmit}>
					<textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Describe the issue..."
						maxLength={500}
						required
						className="mb-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						rows={3}
					/>
					<div className="flex items-center gap-2">
						<button
							type="submit"
							disabled={status === "sending"}
							className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
						>
							{status === "sending" ? "Sending..." : "Submit report"}
						</button>
						{status === "error" && (
							<span className="text-xs text-destructive">
								Failed to submit. Please try again.
							</span>
						)}
					</div>
				</form>
			)}
		</div>
	);
}
