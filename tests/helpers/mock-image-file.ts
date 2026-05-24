import { readFileSync } from "fs";
import { join } from "path";

const FIXTURE_JPEG = readFileSync(join(__dirname, "../fixtures/tiny.jpg"));

/** Valid JPEG bytes for sharp thumbnail generation in tests. */
export function mockJpegBuffer(size = 100): Buffer {
  if (size <= FIXTURE_JPEG.length) return FIXTURE_JPEG;
  return Buffer.concat([FIXTURE_JPEG, Buffer.alloc(size - FIXTURE_JPEG.length, 0)]);
}

export function mockJpegFile(name: string, size = 100): File {
  return new File([new Uint8Array(mockJpegBuffer(size))], name, { type: "image/jpeg" });
}
