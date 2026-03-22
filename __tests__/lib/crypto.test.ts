import { describe, expect, it } from "vitest";
import {
	base64urlDecode,
	base64urlEncode,
	decrypt,
	deriveKeyFromPassword,
	encrypt,
	generateKey,
	generateSalt,
	importKey,
	unwrapDataKey,
	wrapKey,
} from "../../lib/crypto";

// Node.js 18+ exposes globalThis.crypto.subtle natively — no polyfill needed.

describe("base64url helpers", () => {
	it("roundtrips arbitrary bytes", () => {
		const bytes = new Uint8Array([0, 1, 127, 128, 255]);
		const encoded = base64urlEncode(bytes);
		const decoded = base64urlDecode(encoded);
		expect(decoded).toEqual(bytes);
	});

	it("produces URL-safe characters (no +, /, or =)", () => {
		// Fill with 0xFF to maximise +/= in standard base64
		const encoded = base64urlEncode(new Uint8Array(32).fill(0xff));
		expect(encoded).not.toMatch(/[+/=]/);
	});

	it("handles empty buffer", () => {
		const encoded = base64urlEncode(new Uint8Array(0));
		expect(encoded).toBe("");
		expect(base64urlDecode(encoded).byteLength).toBe(0);
	});

	it("accepts ArrayBuffer as well as Uint8Array", () => {
		const arr = new Uint8Array([1, 2, 3]);
		const fromTyped = base64urlEncode(arr);
		const fromBuffer = base64urlEncode(arr.buffer);
		expect(fromTyped).toBe(fromBuffer);
	});
});

describe("generateKey", () => {
	it("returns a CryptoKey and a non-empty keyB64url string", async () => {
		const { cryptoKey, keyB64url } = await generateKey();
		expect(cryptoKey).toBeInstanceOf(CryptoKey);
		expect(typeof keyB64url).toBe("string");
		expect(keyB64url.length).toBeGreaterThan(0);
	});

	it("produces unique keys on each call", async () => {
		const a = await generateKey();
		const b = await generateKey();
		expect(a.keyB64url).not.toBe(b.keyB64url);
	});

	it("raw key decodes to exactly 32 bytes (256 bits)", async () => {
		const { keyB64url } = await generateKey();
		expect(base64urlDecode(keyB64url).byteLength).toBe(32);
	});

	it("key contains no URL-unsafe characters", async () => {
		for (let i = 0; i < 5; i++) {
			const { keyB64url } = await generateKey();
			expect(keyB64url).not.toMatch(/[+/=]/);
		}
	});
});

describe("importKey", () => {
	it("imports a key exported by generateKey", async () => {
		const { keyB64url } = await generateKey();
		const imported = await importKey(keyB64url);
		expect(imported).toBeInstanceOf(CryptoKey);
	});

	it("throws on invalid base64url input", async () => {
		await expect(importKey("not!!!valid")).rejects.toThrow();
	});

	it("imported key has correct algorithm", async () => {
		const { keyB64url } = await generateKey();
		const imported = await importKey(keyB64url);
		// AES-256-GCM key should be 256-bit
		expect((imported.algorithm as AesKeyAlgorithm).length).toBe(256);
	});
});

describe("encrypt", () => {
	it("returns non-empty ciphertext and iv", async () => {
		const { cryptoKey } = await generateKey();
		const { ciphertext, iv } = await encrypt(cryptoKey, "hello");
		expect(typeof ciphertext).toBe("string");
		expect(ciphertext.length).toBeGreaterThan(0);
		expect(typeof iv).toBe("string");
		expect(iv.length).toBeGreaterThan(0);
	});

	it("iv decodes to exactly 12 bytes", async () => {
		const { cryptoKey } = await generateKey();
		const { iv } = await encrypt(cryptoKey, "test");
		expect(base64urlDecode(iv).byteLength).toBe(12);
	});

	it("ciphertext and iv contain no URL-unsafe characters", async () => {
		const { cryptoKey } = await generateKey();
		const { ciphertext, iv } = await encrypt(cryptoKey, "test");
		expect(ciphertext).not.toMatch(/[+/=]/);
		expect(iv).not.toMatch(/[+/=]/);
	});

	it("produces different ciphertexts for the same plaintext (random IV per call)", async () => {
		const { cryptoKey } = await generateKey();
		const a = await encrypt(cryptoKey, "same");
		const b = await encrypt(cryptoKey, "same");
		expect(a.ciphertext).not.toBe(b.ciphertext);
		expect(a.iv).not.toBe(b.iv);
	});

	it("encrypts empty string", async () => {
		const { cryptoKey } = await generateKey();
		const { ciphertext } = await encrypt(cryptoKey, "");
		// AES-GCM with empty plaintext still produces a 16-byte auth tag
		expect(base64urlDecode(ciphertext).byteLength).toBe(16);
	});
});

describe("decrypt", () => {
	it("roundtrip: decrypt(encrypt(plaintext)) === plaintext", async () => {
		const { cryptoKey } = await generateKey();
		const { ciphertext, iv } = await encrypt(cryptoKey, "Hello, world!");
		const result = await decrypt(cryptoKey, ciphertext, iv);
		expect(result).toBe("Hello, world!");
	});

	it("handles unicode and emoji", async () => {
		const { cryptoKey } = await generateKey();
		const text = "こんにちは 🎉 <script>alert('xss')</script>";
		const { ciphertext, iv } = await encrypt(cryptoKey, text);
		expect(await decrypt(cryptoKey, ciphertext, iv)).toBe(text);
	});

	it("handles newlines and tabs", async () => {
		const { cryptoKey } = await generateKey();
		const text = "line1\nline2\t\tindented";
		const { ciphertext, iv } = await encrypt(cryptoKey, text);
		expect(await decrypt(cryptoKey, ciphertext, iv)).toBe(text);
	});

	it("handles large content (~100KB)", async () => {
		const { cryptoKey } = await generateKey();
		const large = "x".repeat(100_000);
		const { ciphertext, iv } = await encrypt(cryptoKey, large);
		expect(await decrypt(cryptoKey, ciphertext, iv)).toBe(large);
	});

	it("throws when decrypting with a different key", async () => {
		const { cryptoKey: k1 } = await generateKey();
		const { cryptoKey: k2 } = await generateKey();
		const { ciphertext, iv } = await encrypt(k1, "secret");
		await expect(decrypt(k2, ciphertext, iv)).rejects.toThrow();
	});

	it("throws on tampered ciphertext (auth tag fails)", async () => {
		const { cryptoKey } = await generateKey();
		const { ciphertext, iv } = await encrypt(cryptoKey, "data");
		// Corrupt the last few characters of the Base64URL ciphertext
		const tampered = ciphertext.slice(0, -4) + "AAAA";
		await expect(decrypt(cryptoKey, tampered, iv)).rejects.toThrow();
	});

	it("throws on wrong iv", async () => {
		const { cryptoKey } = await generateKey();
		const { ciphertext } = await encrypt(cryptoKey, "data");
		const wrongIv = base64urlEncode(crypto.getRandomValues(new Uint8Array(12)));
		await expect(decrypt(cryptoKey, ciphertext, wrongIv)).rejects.toThrow();
	});
});

describe("generateSalt", () => {
	it("returns a 16-byte Uint8Array", () => {
		const salt = generateSalt();
		expect(salt).toBeInstanceOf(Uint8Array);
		expect(salt.byteLength).toBe(16);
	});

	it("produces different salts on each call", () => {
		const a = generateSalt();
		const b = generateSalt();
		expect(a.some((byte, i) => byte !== b[i])).toBe(true);
	});
});

describe("deriveKeyFromPassword", () => {
	it("returns a CryptoKey", async () => {
		const salt = generateSalt();
		const key = await deriveKeyFromPassword("password", salt);
		expect(key).toBeInstanceOf(CryptoKey);
	});

	it("same password and salt produces same key", async () => {
		const salt = generateSalt();
		const key1 = await deriveKeyFromPassword("password", salt);
		const key2 = await deriveKeyFromPassword("password", salt);
		const raw1 = await crypto.subtle.exportKey("raw", key1);
		const raw2 = await crypto.subtle.exportKey("raw", key2);
		expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
	});

	it("different salts produce different keys", async () => {
		const salt1 = generateSalt();
		const salt2 = generateSalt();
		const key1 = await deriveKeyFromPassword("password", salt1);
		const key2 = await deriveKeyFromPassword("password", salt2);
		const raw1 = await crypto.subtle.exportKey("raw", key1);
		const raw2 = await crypto.subtle.exportKey("raw", key2);
		expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
	});

	it("different passwords produce different keys", async () => {
		const salt = generateSalt();
		const key1 = await deriveKeyFromPassword("password1", salt);
		const key2 = await deriveKeyFromPassword("password2", salt);
		const raw1 = await crypto.subtle.exportKey("raw", key1);
		const raw2 = await crypto.subtle.exportKey("raw", key2);
		expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
	});

	it("derived key can be used for wrapKey", async () => {
		const salt = generateSalt();
		const wrappingKey = await deriveKeyFromPassword("password", salt);
		const { cryptoKey: dataKey } = await generateKey();

		const { wrappedKey, iv } = await wrapKey(dataKey, wrappingKey);
		expect(typeof wrappedKey).toBe("string");
		expect(wrappedKey.length).toBeGreaterThan(0);
		expect(typeof iv).toBe("string");
		expect(base64urlDecode(iv).byteLength).toBe(12);
	});
});

describe("wrapKey", () => {
	it("returns non-empty wrappedKey and iv", async () => {
		const wrappingKey = await deriveKeyFromPassword("password", generateSalt());
		const { cryptoKey: dataKey } = await generateKey();

		const { wrappedKey, iv } = await wrapKey(dataKey, wrappingKey);
		expect(typeof wrappedKey).toBe("string");
		expect(wrappedKey.length).toBeGreaterThan(0);
		expect(typeof iv).toBe("string");
		expect(iv.length).toBeGreaterThan(0);
	});

	it("wrappedKey contains no URL-unsafe characters", async () => {
		const wrappingKey = await deriveKeyFromPassword("password", generateSalt());
		const { cryptoKey: dataKey } = await generateKey();

		const { wrappedKey } = await wrapKey(dataKey, wrappingKey);
		expect(wrappedKey).not.toMatch(/[+/=]/);
	});

	it("iv decodes to exactly 12 bytes", async () => {
		const wrappingKey = await deriveKeyFromPassword("password", generateSalt());
		const { cryptoKey: dataKey } = await generateKey();

		const { iv } = await wrapKey(dataKey, wrappingKey);
		expect(base64urlDecode(iv).byteLength).toBe(12);
	});

	it("produces different wrapped keys each time (random IV)", async () => {
		const wrappingKey = await deriveKeyFromPassword("password", generateSalt());
		const { cryptoKey: dataKey } = await generateKey();

		const a = await wrapKey(dataKey, wrappingKey);
		const b = await wrapKey(dataKey, wrappingKey);
		expect(a.wrappedKey).not.toBe(b.wrappedKey);
		expect(a.iv).not.toBe(b.iv);
	});
});

describe("unwrapDataKey", () => {
	it("roundtrip: unwrapDataKey(wrapKey(dataKey)) equals original dataKey", async () => {
		const salt = generateSalt();
		const wrappingKey = await deriveKeyFromPassword("password", salt);
		const { cryptoKey: dataKey } = await generateKey();

		const { wrappedKey, iv } = await wrapKey(dataKey, wrappingKey);
		const unwrappedKey = await unwrapDataKey(wrappedKey, iv, wrappingKey);

		const rawOriginal = await crypto.subtle.exportKey("raw", dataKey);
		const rawUnwrapped = await crypto.subtle.exportKey("raw", unwrappedKey);
		expect(new Uint8Array(rawOriginal)).toEqual(new Uint8Array(rawUnwrapped));
	});

	it("unwrapped key can decrypt what original key encrypted", async () => {
		const salt = generateSalt();
		const wrappingKey = await deriveKeyFromPassword("password", salt);
		const { cryptoKey: dataKey } = await generateKey();

		const { wrappedKey, iv } = await wrapKey(dataKey, wrappingKey);
		const unwrappedKey = await unwrapDataKey(wrappedKey, iv, wrappingKey);

		const { ciphertext, iv: contentIv } = await encrypt(
			dataKey,
			"secret message",
		);
		const decrypted = await decrypt(unwrappedKey, ciphertext, contentIv);
		expect(decrypted).toBe("secret message");
	});

	it("throws when unwrapping with wrong key", async () => {
		const salt = generateSalt();
		const wrappingKey = await deriveKeyFromPassword("password", salt);
		const { cryptoKey: dataKey } = await generateKey();
		const { cryptoKey: wrongKey } = await generateKey();

		const { wrappedKey, iv } = await wrapKey(dataKey, wrappingKey);
		await expect(unwrapDataKey(wrappedKey, iv, wrongKey)).rejects.toThrow();
	});

	it("throws when iv is tampered", async () => {
		const salt = generateSalt();
		const wrappingKey = await deriveKeyFromPassword("password", salt);
		const { cryptoKey: dataKey } = await generateKey();

		const { wrappedKey } = await wrapKey(dataKey, wrappingKey);
		const tamperedIv = base64urlEncode(
			crypto.getRandomValues(new Uint8Array(12)),
		);
		await expect(
			unwrapDataKey(wrappedKey, tamperedIv, wrappingKey),
		).rejects.toThrow();
	});
});
