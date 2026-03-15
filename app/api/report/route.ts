import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { reportPaste } from "@/lib/paste";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
	try {
		const ip = await getClientIp();
		const rateLimit = await checkRateLimit(`report:${ip}`, 5, 3600);

		if (!rateLimit.allowed) {
			return NextResponse.json(
				{ error: "Too many reports. Try again later." },
				{ status: 429 },
			);
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		if (typeof body !== "object" || body === null) {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		const { id, reason } = body as Record<string, unknown>;

		if (!id || typeof id !== "string") {
			return NextResponse.json(
				{ error: "Paste ID is required" },
				{ status: 400 },
			);
		}

		if (!reason || typeof reason !== "string" || reason.length > 500) {
			return NextResponse.json(
				{ error: "Reason is required (max 500 chars)" },
				{ status: 400 },
			);
		}

		await reportPaste(id, reason);

		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof Error && error.message === "Paste not found") {
			return NextResponse.json({ error: "Paste not found" }, { status: 404 });
		}
		console.error("Error reporting paste:", error);
		return NextResponse.json(
			{ error: "Failed to report paste" },
			{ status: 500 },
		);
	}
}
