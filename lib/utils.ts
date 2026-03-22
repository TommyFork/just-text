import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";
import { ID_LENGTH } from "./constants";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
	return format(new Date(timestamp * 1000), "MMM d, yyyy");
}

export function getBaseUrl(requestUrl?: string): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	if (requestUrl) {
		return new URL(requestUrl).origin;
	}
	return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export function isValidPasteId(id: string): boolean {
	// nanoid uses URL-safe characters: [A-Za-z0-9_-]
	// Validate length and characters
	if (typeof id !== "string" || id.length !== ID_LENGTH) {
		return false;
	}

	// Only allow URL-safe characters
	const urlSafeRegex = /^[A-Za-z0-9_-]+$/;
	return urlSafeRegex.test(id);
}
