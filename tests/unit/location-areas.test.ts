import { describe, expect, it } from "vitest";
import { parseLocationCityFile } from "@/lib/location-areas";
import {
  parseDistrictNamesInput,
  parseGermanPlzInput,
} from "@/lib/location-areas-data";

describe("location-areas", () => {
  it("parses city json files", () => {
    const city = parseLocationCityFile(
      JSON.stringify({
        id: "sample",
        name: "Sample City",
        postalCodes: [
          { plz: "28203", districts: ["Fesenfeld", "Ostertor"], centroid: { lat: 53.1, lng: 8.8 } },
        ],
      }),
      "sample.json"
    );
    expect(city?.id).toBe("sample");
    expect(city?.postalCodes[0].districts).toEqual(["Fesenfeld", "Ostertor"]);
    expect(city?.postalCodes[0].centroid).toEqual({ lat: 53.1, lng: 8.8 });
  });

  it("parses district name input", () => {
    expect(parseDistrictNamesInput("A, B\nC;D")).toEqual(["A", "B", "C", "D"]);
  });

  it("parses german plz input", () => {
    expect(parseGermanPlzInput(" 28203 ")).toBe("28203");
    expect(parseGermanPlzInput("abc")).toBeNull();
  });
});
