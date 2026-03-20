import { describe, expect, it } from "vitest";
import {
	DEFAULT_EXPIRY_SECONDS,
	DEFAULT_EXPIRY_VALUE,
	EXPIRY_OPTIONS,
	FORMAT_OPTIONS,
	ID_LENGTH,
	MAX_PASTE_SIZE_BYTES,
	MAX_PASTE_SIZE_LABEL,
	POPULAR_LANGUAGES,
} from "../../lib/constants";

describe("constants", () => {
	it("MAX_PASTE_SIZE_BYTES and MAX_PASTE_SIZE_LABEL are consistent", () => {
		const expected = 5 * 1024 * 1024;
		expect(MAX_PASTE_SIZE_BYTES).toBe(expected);
		expect(MAX_PASTE_SIZE_LABEL).toBe("5MB");
	});

	it("DEFAULT_EXPIRY_SECONDS is 30 days in seconds", () => {
		expect(DEFAULT_EXPIRY_SECONDS).toBe(30 * 24 * 60 * 60);
	});

	it("ID_LENGTH is a positive integer", () => {
		expect(ID_LENGTH).toBeGreaterThan(0);
		expect(Number.isInteger(ID_LENGTH)).toBe(true);
	});

	describe("EXPIRY_OPTIONS", () => {
		it("contains all expected labels", () => {
			const labels = EXPIRY_OPTIONS.map((o) => o.label);
			expect(labels).toContain("1 hour");
			expect(labels).toContain("1 day");
			expect(labels).toContain("7 days");
			expect(labels).toContain("14 days");
			expect(labels).toContain("30 days");
			expect(EXPIRY_OPTIONS).toHaveLength(5);
		});

		it("all values are positive integers", () => {
			EXPIRY_OPTIONS.forEach((o) => {
				expect(o.value).toBeGreaterThan(0);
				expect(Number.isInteger(o.value)).toBe(true);
			});
		});

		it("values match expected durations", () => {
			const byLabel = Object.fromEntries(
				EXPIRY_OPTIONS.map((o) => [o.label, o.value]),
			);
			expect(byLabel["1 hour"]).toBe(3600);
			expect(byLabel["1 day"]).toBe(86400);
			expect(byLabel["7 days"]).toBe(604800);
			expect(byLabel["14 days"]).toBe(1209600);
			expect(byLabel["30 days"]).toBe(2592000);
		});
	});

	it("DEFAULT_EXPIRY_VALUE matches an EXPIRY_OPTIONS value", () => {
		const values = EXPIRY_OPTIONS.map((o) => o.value);
		expect(values).toContain(DEFAULT_EXPIRY_VALUE);
	});

	describe("FORMAT_OPTIONS", () => {
		it("includes plain, markdown, and code", () => {
			const values = FORMAT_OPTIONS.map((o) => o.value);
			expect(values).toContain("plain");
			expect(values).toContain("markdown");
			expect(values).toContain("code");
		});
	});

	describe("POPULAR_LANGUAGES", () => {
		it("contains expected languages", () => {
			const expected = [
				"typescript",
				"javascript",
				"python",
				"rust",
				"go",
				"java",
				"c",
				"cpp",
				"csharp",
				"ruby",
				"php",
				"swift",
				"kotlin",
				"sql",
				"html",
				"css",
				"json",
				"yaml",
				"toml",
				"bash",
				"dockerfile",
				"markdown",
				"plaintext",
			];
			expect(POPULAR_LANGUAGES).toEqual(expected);
		});

		it("has no duplicates", () => {
			expect(new Set(POPULAR_LANGUAGES).size).toBe(POPULAR_LANGUAGES.length);
		});
	});
});
