import { describe, expect, it } from "vitest";
import { formatBytes } from "../../lib/format";

describe("formatBytes", () => {
	it("formats bytes less than 1KB", () => {
		expect(formatBytes(0)).toBe("0 B");
		expect(formatBytes(1)).toBe("1 B");
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1023)).toBe("1023 B");
	});

	it("formats exactly 1KB", () => {
		expect(formatBytes(1024)).toBe("1.0 KB");
	});

	it("formats KB range", () => {
		expect(formatBytes(1025)).toBe("1.0 KB");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(1024 * 100)).toBe("100.0 KB");
		expect(formatBytes(1024 * 1023)).toBe("1023.0 KB");
	});

	it("formats exactly 1MB", () => {
		expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
	});

	it("formats MB range", () => {
		expect(formatBytes(1024 * 1024 + 1)).toBe("1.0 MB");
		expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
		expect(formatBytes(1024 * 1024 * 10.5)).toBe("10.5 MB");
	});

	it("rounds to one decimal place", () => {
		expect(formatBytes(1500)).toBe("1.5 KB");
		expect(formatBytes(1024 * 1024 * 2.25)).toBe("2.3 MB");
	});
});
