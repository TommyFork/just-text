import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { getPaste } from "@/lib/paste";
import { checkReadRateLimit } from "@/lib/rate-limit";

function logApiError(context: string, error: unknown): void {
	if (error instanceof Error) {
		console.error(`Error ${context}:`, error.message);
	} else {
		console.error(`Error ${context}:`, error);
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const ip = await getClientIp();
		const rateLimit = await checkReadRateLimit(ip);

		if (!rateLimit.allowed) {
			return new NextResponse("Rate limit exceeded", { status: 429 });
		}

		const paste = await getPaste(id);
		if (!paste) {
			return new NextResponse("Not found", { status: 404 });
		}

		return new NextResponse(paste.content, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
				"Cache-Control": paste.burnAfterRead
					? "private, no-store"
					: "public, max-age=60",
			},
		});
	} catch (error) {
		logApiError("reading raw paste", error);
		return new NextResponse("Internal server error", { status: 500 });
	}
}
