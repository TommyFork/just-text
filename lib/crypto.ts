// Client-side Zero-Knowledge crypto using the Web Crypto API.
// Works in browser, Web Workers, and Node.js 18+ (globalThis.crypto.subtle).
// The server NEVER imports this file — encryption/decryption is client-only.

// ── Base64URL helpers (RFC 4648 §5, no padding) ───────────────────────────────
// Standard btoa uses +/= which breaks URL parsing. Base64URL uses -_ instead.

export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64urlDecode(s: string): Uint8Array<ArrayBuffer> {
	// Restore standard base64 padding
	const padded = s.replace(/-/g, "+").replace(/_/g, "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const base64 = padded + "=".repeat(padLen);
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length) as Uint8Array<ArrayBuffer>;
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// ── Key generation ─────────────────────────────────────────────────────────────

export async function generateKey(): Promise<{
	cryptoKey: CryptoKey;
	keyB64url: string;
}> {
	const cryptoKey = await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		true, // extractable — we need to export it for the URL hash
		["encrypt", "decrypt"],
	);
	const raw = await crypto.subtle.exportKey("raw", cryptoKey);
	return { cryptoKey, keyB64url: base64urlEncode(raw) };
}

// ── Import a Base64URL key string back into a CryptoKey ───────────────────────

export async function importKey(keyB64url: string): Promise<CryptoKey> {
	const raw = base64urlDecode(keyB64url);
	return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
		"decrypt",
	]);
}

// ── Encryption ─────────────────────────────────────────────────────────────────
// Returns Base64URL-encoded ciphertext (SubtleCrypto appends the 16-byte GCM
// auth tag at the end of the buffer automatically) and a 12-byte Base64URL IV.

export async function encrypt(
	key: CryptoKey,
	plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes = NIST recommendation
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertextBuf = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);
	return {
		ciphertext: base64urlEncode(ciphertextBuf),
		iv: base64urlEncode(iv),
	};
}

// ── Password-based key derivation (Argon2id via PBKDF2-SHA256 fallback) ─────────
// Uses PBKDF2 with high iteration count as a fallback when Argon2id is unavailable.
// For production, prefer a native Argon2id implementation via argon2-browser.

const PBKDF2_ITERATIONS = 600_000; // OWASP recommendation for PBKDF2-SHA256 (2023)
const SALT_LENGTH = 16; // 128 bits

export async function deriveKeyFromPassword(
	password: string,
	salt: Uint8Array,
): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		passwordBuffer,
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"],
	);

	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt.buffer as ArrayBuffer,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		true, // extractable for wrapping
		["wrapKey", "unwrapKey"],
	);
}

export function generateSalt(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

// ── Key wrapping (encrypt dataKey with derived key) ──────────────────────────────
// Used when password-protecting a paste.

export async function wrapKey(
	dataKey: CryptoKey,
	wrappingKey: CryptoKey,
): Promise<{ wrappedKey: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const wrapped = await crypto.subtle.wrapKey("raw", dataKey, wrappingKey, {
		name: "AES-GCM",
		iv,
	});
	return {
		wrappedKey: base64urlEncode(wrapped),
		iv: base64urlEncode(iv),
	};
}

// ── Key unwrapping (decrypt wrapped key with derived key) ─────────────────────

export async function unwrapDataKey(
	wrappedKey: string,
	iv: string,
	unwrappingKey: CryptoKey,
): Promise<CryptoKey> {
	return crypto.subtle.unwrapKey(
		"raw",
		base64urlDecode(wrappedKey).buffer as ArrayBuffer,
		unwrappingKey,
		{ name: "AES-GCM", iv: base64urlDecode(iv).buffer as ArrayBuffer },
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);
}

// ── Decryption ─────────────────────────────────────────────────────────────────
// Throws DOMException("OperationError") if the auth tag doesn't match
// (tampered ciphertext, wrong key, or wrong IV).

export async function decrypt(
	key: CryptoKey,
	ciphertext: string,
	iv: string,
): Promise<string> {
	const ciphertextBytes = base64urlDecode(ciphertext);
	const ivBytes = base64urlDecode(iv);
	const plaintextBuf = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: ivBytes },
		key,
		ciphertextBytes,
	);
	return new TextDecoder().decode(plaintextBuf);
}
