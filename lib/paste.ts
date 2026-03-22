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

	// Password protection (optional)
	passwordProtected: boolean;
	key?: string; // Base64URL — raw dataKey (only if NOT password-protected, server CAN decrypt)
	salt?: string; // Base64URL — 16-byte PBKDF2 salt (only if password-protected)
	wrappedKey?: string; // Base64URL — dataKey encrypted with password-derived key (only if password-protected)
	wrapIv?: string; // Base64URL — 12-byte IV for key wrapping (only if password-protected)
}

export interface CreatePasteInput {
	ciphertext: string;
	iv: string;
	format: PasteFormat;
	language?: string;
	expirySeconds: number;
	burnAfterRead: boolean;
	sizeBytes: number;
	// Password protection (optional)
	passwordProtected: boolean;
	key?: string; // Raw dataKey (if not password-protected)
	salt?: string; // PBKDF2 salt (if password-protected)
	wrappedKey?: string; // Wrapped dataKey (if password-protected)
	wrapIv?: string; // Wrap IV (if password-protected)
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
	passwordProtected: boolean;
	key?: string;
	salt?: string;
	wrappedKey?: string;
	wrapIv?: string;
}

function pasteKey(id: string): string {
	return `paste:${id}`;
}

// Atomically handles both burn-after-read (GET+DEL) and normal reads (GET+INCR+SET KEEPTTL).
// Uses Redis lock to prevent race conditions on burn-after-read pastes.
// Returns the JSON string of the paste state to return to the caller:
//   - burn-after-read: the original value (paste is deleted)
//   - normal: the updated value with incremented viewCount
const LUA_GET_PASTE = `
-- Try to acquire lock with 100ms timeout
local lockKey = KEYS[1] .. ":lock"
local lockAcquired = redis.call('SET', lockKey, '1', 'NX', 'PX', 100)
if not lockAcquired then
  -- Wait and retry once
  redis.call('PEXPIRE', lockKey, 100)
  return false
end

local raw = redis.call('GET', KEYS[1])
if not raw then 
  redis.call('DEL', lockKey)
  return false 
end

local data = cjson.decode(raw)
if data.burnAfterRead then
  -- Delete paste and release lock
  redis.call('DEL', KEYS[1])
  redis.call('DEL', lockKey)
  return raw
else
  data.viewCount = (data.viewCount or 0) + 1
  local updated = cjson.encode(data)
  redis.call('SET', KEYS[1], updated, 'KEEPTTL')
  redis.call('DEL', lockKey)
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
		passwordProtected: input.passwordProtected,
		key: input.key,
		salt: input.salt,
		wrappedKey: input.wrappedKey,
		wrapIv: input.wrapIv,
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

export async function getPasteMetadata(id: string): Promise<{
	id: string;
	format: PasteFormat;
	language?: string;
	createdAt: number;
	expiresAt: number | null;
	burnAfterRead: boolean;
	viewCount: number;
	sizeBytes: number;
	passwordProtected: boolean;
} | null> {
	const redis = getRedis();
	const key = pasteKey(id);

	const raw = await redis.get(key);
	if (!raw) return null;

	try {
		const stored = JSON.parse(raw) as StoredPaste;
		const {
			ciphertext: _c,
			iv: _iv,
			key: _k,
			salt: _s,
			wrappedKey: _wk,
			wrapIv: _wi,
			...metadata
		} = stored;
		return metadata;
	} catch {
		return null;
	}
}
