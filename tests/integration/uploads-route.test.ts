import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/uploads/[...path]/route";
import { getUploadsRoot } from "@/lib/pickhome-data";
import { withIsolatedDataDir } from "../helpers/test-db";

describe("uploads route GET", () => {
  let dataDir: ReturnType<typeof withIsolatedDataDir>;

  beforeAll(() => {
    dataDir = withIsolatedDataDir();
  });

  afterAll(() => {
    dataDir.restore();
  });

  it("rejects path traversal", async () => {
    const res = await GET(new Request("http://localhost/uploads/x"), {
      params: Promise.resolve({ path: ["..", "secret.txt"] }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing file", async () => {
    const res = await GET(new Request("http://localhost/uploads/x"), {
      params: Promise.resolve({ path: ["apartments", "missing", "nope.jpg"] }),
    });
    expect(res.status).toBe(404);
  });

  it("serves existing files with MIME type", async () => {
    const relDir = join("apartments", "route-test");
    const dir = join(getUploadsRoot(), relDir);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "photo.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    await writeFile(join(dir, "doc.pdf"), Buffer.from("%PDF"));

    const jpgRes = await GET(new Request("http://localhost/uploads/x"), {
      params: Promise.resolve({ path: [...relDir.split("/"), "photo.jpg"] }),
    });
    expect(jpgRes.status).toBe(200);
    expect(jpgRes.headers.get("Content-Type")).toBe("image/jpeg");

    const pdfRes = await GET(new Request("http://localhost/uploads/x"), {
      params: Promise.resolve({ path: [...relDir.split("/"), "doc.pdf"] }),
    });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("Content-Type")).toBe("application/pdf");

    await writeFile(join(dir, "unknown.bin"), Buffer.from([1, 2, 3]));
    const binRes = await GET(new Request("http://localhost/uploads/x"), {
      params: Promise.resolve({ path: [...relDir.split("/"), "unknown.bin"] }),
    });
    expect(binRes.headers.get("Content-Type")).toBe("application/octet-stream");
  });
});
