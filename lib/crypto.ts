import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const _AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
	const hex = process.env.ENCRYPTION_KEY;
	if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
		throw new Error(
			"ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32",
		);
	}
	return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plaintext, "utf8");
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	const authTag = cipher.getAuthTag();

	// Format: iv:authTag:ciphertext (all base64)
	return [
		iv.toString("base64"),
		authTag.toString("base64"),
		encrypted.toString("base64"),
	].join(":");
}

export function decrypt(payload: string): string {
	const key = getKey();
	const [ivB64, authTagB64, ciphertextB64] = payload.split(":");

	if (!ivB64 || !authTagB64 || !ciphertextB64) {
		throw new Error("Invalid encrypted payload format");
	}

	const iv = Buffer.from(ivB64, "base64");
	const authTag = Buffer.from(authTagB64, "base64");
	const ciphertext = Buffer.from(ciphertextB64, "base64");

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(ciphertext);
	decrypted = Buffer.concat([decrypted, decipher.final()]);

	return decrypted.toString("utf8");
}
