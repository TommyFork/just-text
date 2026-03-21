import { nanoid } from "nanoid";
import { ID_LENGTH, type PasteFormat } from "./constants";
import { getRedis } from "./redis";

// Max ciphertext size: ~7MB accounts for Base64 expansion of a 5MB plaintext
// (AES-GCM adds 16-byte auth tag; Base64 expands ~1.37x)
const MAX_CIPHERTEXT_BYTES = 7 * 1024 * 1024;

export interface Paste {
	id: string;
	ciphertext: string; // Base64URL — client-encrypted (AES-256-GCM, includes auth tag)
	iv: string; // Base64URL — 12-byte AES-GCM IV
	format: PasteFormat;
	language?: string;
	createdAt: number;
	expiresAt: number | null;
	burnAfterRead: boolean;
	viewCount: number;
	sizeBytes: number; // plaintext byte length, measured by client before encryption
}

export interface CreatePasteInput {
	ciphertext: string;
	iv: string;
	format: PasteFormat;
	language?: string;
	expirySeconds: number;
	burnAfterRead: boolean;
	sizeBytes: number;
}

interface StoredPaste {
	id: string;
	ciphertext: string;
	iv: string;
	format: PasteFormat;
	language?: string;
	createdAt: number;
	expiresAt: number | null;
	burnAfterRead: boolean;
	viewCount: number;
	sizeBytes: number;
}

function pasteKey(id: string): string {
	return `paste:${id}`;
}

// Atomically handles both burn-after-read (GET+DEL) and normal reads (GET+INCR+SET KEEPTTL).
// Returns the JSON string of the paste state to return to the caller:
//   - burn-after-read: the original value (paste is deleted)
//   - normal: the updated value with incremented viewCount
const LUA_GET_PASTE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local data = cjson.decode(raw)
if data.burnAfterRead then
  redis.call('DEL', KEYS[1])
  return raw
else
  data.viewCount = (data.viewCount or 0) + 1
  local updated = cjson.encode(data)
  redis.call('SET', KEYS[1], updated, 'KEEPTTL')
  return updated
end
`;

export async function createPaste(input: CreatePasteInput): Promise<Paste> {
	if (!input.ciphertext) {
		throw new Error("Ciphertext cannot be empty");
	}

	if (input.ciphertext.length > MAX_CIPHERTEXT_BYTES) {
		throw new Error(`Ciphertext exceeds maximum size`);
	}

	const redis = getRedis();
	const id = nanoid(ID_LENGTH);
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = input.expirySeconds > 0 ? now + input.expirySeconds : null;

	const stored: StoredPaste = {
		id,
		ciphertext: input.ciphertext,
		iv: input.iv,
		format: input.format,
		language: input.language,
		createdAt: now,
		expiresAt,
		burnAfterRead: input.burnAfterRead,
		viewCount: 0,
		sizeBytes: input.sizeBytes,
	};

	const key = pasteKey(id);

	if (input.expirySeconds > 0) {
		await redis.set(key, JSON.stringify(stored), "EX", input.expirySeconds);
	} else {
		await redis.set(key, JSON.stringify(stored));
	}

	return stored;
}

export async function getPaste(id: string): Promise<Paste | null> {
	const redis = getRedis();
	const key = pasteKey(id);

	const result = await redis.eval(LUA_GET_PASTE, 1, key);
	if (!result) return null;

	try {
		return JSON.parse(result as string) as StoredPaste;
	} catch {
		return null;
	}
}

export async function getPasteMetadata(
	id: string,
): Promise<Omit<Paste, "ciphertext" | "iv"> | null> {
	const redis = getRedis();
	const key = pasteKey(id);

	const raw = await redis.get(key);
	if (!raw) return null;

	try {
		const stored = JSON.parse(raw) as StoredPaste;
		const { ciphertext: _c, iv: _iv, ...metadata } = stored;
		return metadata;
	} catch {
		return null;
	}
}
