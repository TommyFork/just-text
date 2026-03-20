import { nanoid } from "nanoid";
import { ID_LENGTH, MAX_PASTE_SIZE_BYTES, type PasteFormat } from "./constants";
import { decrypt, encrypt } from "./crypto";
import { getRedis } from "./redis";

export interface Paste {
	id: string;
	content: string;
	format: PasteFormat;
	language?: string;
	createdAt: number;
	expiresAt: number | null;
	burnAfterRead: boolean;
	viewCount: number;
	sizeBytes: number;
}

export interface CreatePasteInput {
	content: string;
	format: PasteFormat;
	language?: string;
	expirySeconds: number;
	burnAfterRead: boolean;
}

interface StoredPaste {
	id: string;
	content: string; // encrypted
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
	const sizeBytes = Buffer.byteLength(input.content, "utf8");
	if (sizeBytes > MAX_PASTE_SIZE_BYTES) {
		throw new Error(
			`Content exceeds maximum size of ${MAX_PASTE_SIZE_BYTES} bytes`,
		);
	}

	if (sizeBytes === 0) {
		throw new Error("Content cannot be empty");
	}

	// Validate UTF-8 and strip null bytes
	const cleanContent = input.content.replace(/\0/g, "");

	const redis = getRedis();
	const id = nanoid(ID_LENGTH);
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = input.expirySeconds > 0 ? now + input.expirySeconds : null;

	const stored: StoredPaste = {
		id,
		content: encrypt(cleanContent),
		format: input.format,
		language: input.language,
		createdAt: now,
		expiresAt,
		burnAfterRead: input.burnAfterRead,
		viewCount: 0,
		sizeBytes,
	};

	const key = pasteKey(id);

	if (input.expirySeconds > 0) {
		await redis.set(key, JSON.stringify(stored), "EX", input.expirySeconds);
	} else {
		await redis.set(key, JSON.stringify(stored));
	}

	return {
		...stored,
		content: cleanContent,
	};
}

export async function getPaste(id: string): Promise<Paste | null> {
	const redis = getRedis();
	const key = pasteKey(id);

	const result = await redis.eval(LUA_GET_PASTE, 1, key);
	if (!result) return null;

	let stored: StoredPaste;
	try {
		stored = JSON.parse(result as string);
	} catch {
		return null;
	}

	return {
		...stored,
		content: decrypt(stored.content),
	};
}

export async function getPasteMetadata(
	id: string,
): Promise<Omit<Paste, "content"> | null> {
	const redis = getRedis();
	const key = pasteKey(id);

	const raw = await redis.get(key);
	if (!raw) return null;

	let stored: StoredPaste;
	try {
		stored = JSON.parse(raw);
	} catch {
		return null;
	}

	const { content: _content, ...metadata } = stored;

	return metadata;
}
