import { vi } from "vitest";
import {
  mockAuthState,
  mockGeocodeAddress,
  redirectError,
} from "./action-mocks";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw redirectError(url);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockAuthState.user),
    requireUser: vi.fn(async () => {
      if (!mockAuthState.user) throw redirectError("/login");
      return mockAuthState.user;
    }),
    requireAdmin: vi.fn(async () => {
      if (!mockAuthState.user) throw redirectError("/login");
      if (!actual.isAdmin(mockAuthState.user)) throw redirectError("/dashboard");
      return mockAuthState.user;
    }),
  };
});

vi.mock("@/lib/geocode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geocode")>();
  return {
    ...actual,
    geocodeAddress: vi.fn(async (address: string) => mockGeocodeAddress(address)),
    reverseGeocodeAddress: vi.fn(async () => mockGeocodeAddress("reverse")),
  };
});

vi.mock("@/lib/apartment-address-enrichment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apartment-address-enrichment")>();
  return {
    ...actual,
    scheduleApartmentAddressEnrichment: vi.fn(),
  };
});
