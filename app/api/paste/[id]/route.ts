import { NextRequest, NextResponse } from "next/server";
import {
	createErrorResponse,
	createJsonResponse,
	logApiError,
} from "@/lib/error";
import { getClientIp } from "@/lib/ip";
import { getPaste } from "@/lib/paste";
import { checkReadRateLimit } from "@/lib/rate-limit";
import { isValidPasteId } from "@/lib/utils";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;

		// Validate paste ID
		if (!isValidPasteId(id)) {
			return createErrorResponse("Invalid paste ID", 400, "INVALID_ID", {
				"Access-Control-Allow-Origin": "*",
			});
		}

		const ip = await getClientIp();
		const rateLimit = await checkReadRateLimit(ip);

		if (!rateLimit.allowed) {
			return createErrorResponse(
				"Rate limit exceeded",
				429,
				"RATE_LIMIT_EXCEEDED",
				{
					"Retry-After": String(
						rateLimit.resetAt - Math.floor(Date.now() / 1000),
					),
					"Access-Control-Allow-Origin": "*",
				},
			);
		}

		const paste = await getPaste(id);
		if (!paste) {
			return createErrorResponse(
				"Paste not found or has expired",
				404,
				"NOT_FOUND",
				{
					"Access-Control-Allow-Origin": "*",
				},
			);
		}

		return createJsonResponse(paste, 200, {
			"Cache-Control": paste.burnAfterRead
				? "private, no-store"
				: "public, max-age=300",
			"Access-Control-Allow-Origin": "*",
		});
	} catch (error) {
		logApiError("reading paste", error);
		return createErrorResponse("Failed to read paste", 500, "INTERNAL_ERROR", {
			"Access-Control-Allow-Origin": "*",
		});
	}
}
