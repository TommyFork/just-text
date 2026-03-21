import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

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
