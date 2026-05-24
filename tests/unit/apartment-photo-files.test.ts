import { describe, expect, it, vi } from "vitest";
import { pickValidImageFiles } from "@/lib/apartment-photo-files";
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits";

function mockFile(name: string, type: string, size: number) {
  return new File([Buffer.alloc(size, 0x41)], name, { type });
}

describe("apartment-photo-files", () => {
  it("returns empty array for empty input", () => {
    const rejected = vi.fn();
    expect(pickValidImageFiles([], rejected)).toEqual([]);
    expect(rejected).not.toHaveBeenCalled();
  });

  it("filters empty files", () => {
    const rejected = vi.fn();
    const valid = pickValidImageFiles([mockFile("empty.jpg", "image/jpeg", 0)], rejected);
    expect(valid).toEqual([]);
    expect(rejected).not.toHaveBeenCalled();
  });

  it("filters oversized files and reports rejection", () => {
    const rejected = vi.fn();
    const valid = pickValidImageFiles(
      [mockFile("big.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1)],
      rejected
    );
    expect(valid).toEqual([]);
    expect(rejected).toHaveBeenCalledOnce();
  });

  it("keeps valid files", () => {
    const rejected = vi.fn();
    const file = mockFile("ok.jpg", "image/jpeg", 500);
    const valid = pickValidImageFiles([file], rejected);
    expect(valid).toEqual([file]);
    expect(rejected).not.toHaveBeenCalled();
  });
});
