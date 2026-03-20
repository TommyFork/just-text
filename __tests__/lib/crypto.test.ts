import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../../lib/crypto";

const VALID_KEY = "a".repeat(64); // 64-char hex string

describe("crypto", () => {
	beforeEach(() => {
		process.env.ENCRYPTION_KEY = VALID_KEY;
	});

	afterEach(() => {
		delete process.env.ENCRYPTION_KEY;
	});

	describe("encrypt", () => {
		it("returns a colon-separated iv:authTag:ciphertext string", () => {
			const result = encrypt("hello");
			const parts = result.split(":");
			expect(parts).toHaveLength(3);
			// Each part should be non-empty base64
			parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
		});

		it("produces different ciphertexts for the same plaintext (random IV)", () => {
			const a = encrypt("same text");
			const b = encrypt("same text");
			expect(a).not.toBe(b);
		});

		it("throws when ENCRYPTION_KEY is missing", () => {
			delete process.env.ENCRYPTION_KEY;
			expect(() => encrypt("hello")).toThrow("ENCRYPTION_KEY");
		});

		it("throws when ENCRYPTION_KEY is wrong length", () => {
			process.env.ENCRYPTION_KEY = "tooshort";
			expect(() => encrypt("hello")).toThrow("ENCRYPTION_KEY");
		});

		it("throws when ENCRYPTION_KEY has invalid hex characters", () => {
			process.env.ENCRYPTION_KEY = "g".repeat(64);
			expect(() => encrypt("hello")).toThrow("ENCRYPTION_KEY");
		});

		it("throws when ENCRYPTION_KEY is 64 chars but mixed case invalid chars", () => {
			process.env.ENCRYPTION_KEY = "G".repeat(64);
			expect(() => encrypt("hello")).toThrow("ENCRYPTION_KEY");
		});

		it("encrypts empty string", () => {
			const result = encrypt("");
			const parts = result.split(":");
			expect(parts).toHaveLength(3);
		});

		it("encrypts content at 5MB boundary", () => {
			const maxContent = "x".repeat(5 * 1024 * 1024);
			const encrypted = encrypt(maxContent);
			expect(encrypted.split(":")).toHaveLength(3);
		});
	});

	describe("decrypt", () => {
		it("roundtrip: decrypt(encrypt(plaintext)) === plaintext", () => {
			const plaintext = "Hello, world!";
			expect(decrypt(encrypt(plaintext))).toBe(plaintext);
		});

		it("handles unicode and special characters", () => {
			const text = "こんにちは 🎉 <script>alert('xss')</script>";
			expect(decrypt(encrypt(text))).toBe(text);
		});

		it("handles large content", () => {
			const large = "x".repeat(100_000);
			expect(decrypt(encrypt(large))).toBe(large);
		});

		it("throws on invalid payload format (missing parts)", () => {
			expect(() => decrypt("onlyone")).toThrow(
				"Invalid encrypted payload format",
			);
		});

		it("throws on invalid payload format (two parts)", () => {
			expect(() => decrypt("part1:part2")).toThrow(
				"Invalid encrypted payload format",
			);
		});

		it("throws on tampered ciphertext (auth tag mismatch)", () => {
			const encrypted = encrypt("sensitive data");
			const [iv, authTag] = encrypted.split(":");
			const tampered = `${iv}:${authTag}:AAAAAAAAAA==`;
			expect(() => decrypt(tampered)).toThrow();
		});

		it("throws on invalid base64 in ciphertext", () => {
			const encrypted = encrypt("test");
			const [iv, authTag] = encrypted.split(":");
			const invalid = `${iv}:${authTag}:not!!!base64===`;
			expect(() => decrypt(invalid)).toThrow();
		});

		it("throws on empty payload", () => {
			expect(() => decrypt("")).toThrow("Invalid encrypted payload format");
		});

		it("handles single character", () => {
			expect(decrypt(encrypt("a"))).toBe("a");
		});

		it("handles newlines and tabs", () => {
			const text = "line1\nline2\t\tindented";
			expect(decrypt(encrypt(text))).toBe(text);
		});
	});
});
