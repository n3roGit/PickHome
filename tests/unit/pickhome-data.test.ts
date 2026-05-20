import { afterEach, describe, expect, it } from "vitest";
import {
  getApartmentUploadsRoot,
  getPickHomeDataDir,
  getUploadsRoot,
  publicPhotoPath,
} from "@/lib/pickhome-data";
import { join } from "path";

describe("pickhome-data paths", () => {
  const original = process.env.PICKHOME_DATA_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.PICKHOME_DATA_DIR;
    else process.env.PICKHOME_DATA_DIR = original;
  });

  it("defaults to ./data under cwd", () => {
    delete process.env.PICKHOME_DATA_DIR;
    expect(getPickHomeDataDir()).toBe(join(process.cwd(), "data"));
  });

  it("resolves relative PICKHOME_DATA_DIR", () => {
    process.env.PICKHOME_DATA_DIR = "./custom-data";
    expect(getPickHomeDataDir()).toBe(join(process.cwd(), "custom-data"));
  });

  it("keeps absolute PICKHOME_DATA_DIR unchanged", () => {
    const abs = join(process.cwd(), "absolute-data-root");
    process.env.PICKHOME_DATA_DIR = abs;
    expect(getPickHomeDataDir()).toBe(abs);
  });

  it("maps public upload URLs to filesystem paths", () => {
    delete process.env.PICKHOME_DATA_DIR;
    const url = "/uploads/apartments/apt-1/photo.jpg";
    expect(publicPhotoPath(url)).toBe(
      join(process.cwd(), "data", "uploads", "apartments", "apt-1", "photo.jpg")
    );
  });

  it("rejects URLs outside uploads", () => {
    expect(publicPhotoPath("/other/file.jpg")).toBeNull();
  });

  it("exposes upload roots", () => {
    delete process.env.PICKHOME_DATA_DIR;
    expect(getUploadsRoot()).toBe(join(process.cwd(), "data", "uploads"));
    expect(getApartmentUploadsRoot()).toBe(
      join(process.cwd(), "data", "uploads", "apartments")
    );
  });
});
