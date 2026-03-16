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
	it("MAX_PASTE_SIZE_BYTES is 5MB", () => {
		expect(MAX_PASTE_SIZE_BYTES).toBe(5 * 1024 * 1024);
	});

	it("MAX_PASTE_SIZE_LABEL is '5MB'", () => {
		expect(MAX_PASTE_SIZE_LABEL).toBe("5MB");
	});

	it("DEFAULT_EXPIRY_SECONDS is 30 days", () => {
		expect(DEFAULT_EXPIRY_SECONDS).toBe(30 * 24 * 60 * 60);
	});

	it("ID_LENGTH is a positive integer", () => {
		expect(ID_LENGTH).toBeGreaterThan(0);
		expect(Number.isInteger(ID_LENGTH)).toBe(true);
	});

	describe("EXPIRY_OPTIONS", () => {
		it("contains expected labels", () => {
			const labels = EXPIRY_OPTIONS.map((o) => o.label);
			expect(labels).toContain("1 hour");
			expect(labels).toContain("1 day");
			expect(labels).toContain("30 days");
		});

		it("all values are positive integers", () => {
			EXPIRY_OPTIONS.forEach((o) => {
				expect(o.value).toBeGreaterThan(0);
				expect(Number.isInteger(o.value)).toBe(true);
			});
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
		it("includes common languages", () => {
			expect(POPULAR_LANGUAGES).toContain("typescript");
			expect(POPULAR_LANGUAGES).toContain("python");
			expect(POPULAR_LANGUAGES).toContain("rust");
			expect(POPULAR_LANGUAGES).toContain("json");
		});

		it("has no duplicates", () => {
			expect(new Set(POPULAR_LANGUAGES).size).toBe(POPULAR_LANGUAGES.length);
		});
	});
});
