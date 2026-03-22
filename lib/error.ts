// Consistent error handling utilities

export function logApiError(context: string, error: unknown): void {
	if (error instanceof Error) {
		console.error(`Error ${context}:`, error.message, error.stack);
	} else {
		console.error(`Error ${context}:`, error);
	}
}

export interface ApiErrorResponse {
	error: string;
	code?: string;
}

export function createErrorResponse(
	message: string,
	status: number,
	code?: string,
	headers?: Record<string, string>,
): Response {
	const body: ApiErrorResponse = { error: message };
	if (code) {
		body.code = code;
	}

	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	});
}

export function createJsonResponse<T>(
	data: T,
	status = 200,
	headers?: Record<string, string>,
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	});
}
