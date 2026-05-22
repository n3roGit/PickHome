"use server";

import { rm } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  destroySession,
  getSessionUser,
  hashPassword,
  isAdmin,
  requireAdmin,
  requireUser,
  ROLE_USER,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteApartmentPhotoFile,
  saveApartmentDocument,
} from "@/lib/apartment-media";
import { extractPdfText } from "@/lib/pdf-text";
import {
  invalidateCommuteCacheForApartment,
  invalidateCommuteCacheForUser,
  invalidateCommuteCacheForUserAddress,
} from "@/lib/commute-cache";
import {
  resolveApartmentGeocode,
  scheduleApartmentAddressEnrichment,
} from "@/lib/apartment-address-enrichment";
import { applyGeocodeToStoredAddress, geocodeAddress } from "@/lib/geocode";
import {
  PRICE_HISTORY_SOURCE_MANUAL,
  recordApartmentPriceChange,
} from "@/lib/apartment-price-history";
import { parseEnergyClassInput } from "@/lib/listing-import";
import { normalizeListingUrl } from "@/lib/listing-url";
import { readPasswordPair } from "@/lib/password";
import { getApartmentUploadsRoot } from "@/lib/pickhome-data";
import { join } from "path";
import {
  apartmentAccessWhere,
  projectAccessWhere,
} from "@/lib/project-access";
import {
  assertApartmentAccess,
  assertCriterionGroupAccess,
  assertProjectAccess,
  seedProjectCriteria,
} from "@/lib/project-data";
import { parseBrokerBuyerRatePercent, parseFederalStateCode, parseInterestRatePercent, parsePositiveInt } from "@/lib/purchase-costs";
import { parseArchiveNote, parseArchiveReason } from "@/lib/archive-reasons";
import { parseDealbreakerThreshold } from "@/lib/scoring";
import { syncApartmentViewedAt } from "@/lib/viewings";
import {
  parseCompanyCarRate,
  parseCompanyCarCommuteMethod,
  parseListPriceEuros,
  parseMarginalTaxRatePercent,
  parseOfficeTripsPerMonth,
  parseOptionalEuroAmount,
} from "@/lib/company-car";
import {
  parseCommuteAllowanceDays,
  parseOptionalDayCount,
  resolveHomeOfficeDays,
  resolveSickDays,
  resolveVacationDays,
} from "@/lib/commuter-allowance";
import { parseTravelMode } from "@/lib/travel-mode";
import {
  parseTransitArrivalHour,
  parseTransitArrivalMinute,
  parseTransitArrivalWeekday,
  parseTransitFallbackMaxKm,
  parseTransitFallbackMode,
} from "@/lib/transit-settings";
import { isApartmentUploadError } from "@/lib/upload-limits";
import type { UploadApartmentFileResult } from "@/app/apartment-photo-actions";
import {
  redirectApartmentRevisionConflict,
  requireRevisionFromForm,
  updateApartmentIfRevisionMatches,
} from "@/lib/apartment-revision";

function revalidateApartment(projectId: string, apartmentId: string) {
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/apartment/${apartmentId}`);
  revalidatePath(`/project/${projectId}/apartment/${apartmentId}/checklist`);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function deleteProjectAction(projectId: string) {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: projectAccessWhere(projectId, user),
    include: { apartments: { select: { id: true } } },
  });
  if (!project) redirect("/dashboard");

  for (const apt of project.apartments) {
    try {
      await rm(join(getApartmentUploadsRoot(), apt.id), {
        recursive: true,
        force: true,
      });
    } catch {
      // upload folder may not exist
    }
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const budgetRaw = String(formData.get("budget") ?? "").trim();
  if (!name) return;
  const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, ""), 10) : null;
  const project = await prisma.project.create({
    data: {
      name,
      budget: Number.isFinite(budget) ? budget : null,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  await seedProjectCriteria(project.id);
  revalidatePath("/dashboard");
  redirect(`/project/${project.id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  const user = await requireUser();

  const base = `/project/${projectId}?tab=settings`;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`${base}&settings_error=name`);

  const budgetRaw = String(formData.get("budget") ?? "").trim();
  const budget = budgetRaw ? parseInt(budgetRaw.replace(/\D/g, ""), 10) : null;
  const federalStateCode = parseFederalStateCode(
    String(formData.get("federalStateCode") ?? "")
  );
  const brokerBuyerRate = parseBrokerBuyerRatePercent(
    String(formData.get("brokerBuyerRate") ?? "")
  );
  const equityAmountRaw = String(formData.get("equityAmount") ?? "").trim();
  const equityAmount = equityAmountRaw
    ? parseInt(equityAmountRaw.replace(/\D/g, ""), 10)
    : null;
  const loanTermYears = parsePositiveInt(String(formData.get("loanTermYears") ?? ""));
  const interestRate = parseInterestRatePercent(String(formData.get("interestRate") ?? ""));
  const netIncomeRaw = String(formData.get("netHouseholdIncome") ?? "").trim();
  const netHouseholdIncome = netIncomeRaw
    ? parseInt(netIncomeRaw.replace(/\D/g, ""), 10)
    : null;
  const dealbreakerThreshold = parseDealbreakerThreshold(
    String(formData.get("dealbreakerThreshold") ?? "")
  );

  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      budget: Number.isFinite(budget) ? budget : null,
      federalStateCode,
      brokerBuyerRate,
      equityAmount: Number.isFinite(equityAmount) ? equityAmount : null,
      loanTermYears,
      interestRate,
      netHouseholdIncome: Number.isFinite(netHouseholdIncome) ? netHouseholdIncome : null,
      dealbreakerThreshold,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&settings_saved=1`);
}

export async function updateProjectAreaFilterAction(
  projectId: string,
  payload: {
    ortKeys: string[];
    selectedPlz: string[];
    selectedDistricts: string[];
    mode?: "allow" | "deny";
    circleRadiusM?: number;
  }
) {
  const user = await requireUser();
  const base = `/project/${projectId}?tab=map`;

  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const ortKeys = [...new Set(payload.ortKeys.map((k) => k.trim()).filter(Boolean))];
  const selectedPlz = [...new Set(payload.selectedPlz.map(String))].sort();
  const selectedDistricts = [...new Set(payload.selectedDistricts.map(String))].sort((a, b) =>
    a.localeCompare(b, "de")
  );

  if (ortKeys.length > 0 && selectedPlz.length === 0) {
    redirect(`${base}&areas_error=ort`);
  }

  const { findOrtByKey } = await import("@/lib/plz-reference");
  const orte = ortKeys.map((key) => ({ key, ort: findOrtByKey(key) }));
  if (ortKeys.length > 0 && orte.some((entry) => !entry.ort)) {
    redirect(`${base}&areas_error=ort`);
  }

  const allowedPlz = new Set(
    orte.flatMap((entry) => entry.ort?.plz ?? [])
  );
  if (ortKeys.length > 0 && selectedPlz.some((plz) => !allowedPlz.has(plz))) {
    redirect(`${base}&areas_error=ort`);
  }

  const { normalizePlzMapCircleRadiusM, serializeAreaFilterConfig } = await import(
    "@/lib/area-filter"
  );
  const mode = payload.mode === "deny" ? "deny" : "allow";
  const circleRadiusM =
    payload.circleRadiusM != null
      ? normalizePlzMapCircleRadiusM(payload.circleRadiusM)
      : undefined;
  const config =
    ortKeys.length > 0 && selectedPlz.length > 0
      ? serializeAreaFilterConfig({
          ortKeys,
          selectedPlz,
          selectedDistricts,
          mode,
          ...(circleRadiusM != null ? { circleRadiusM } : {}),
        })
      : null;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      areaFilterOrtKey: ortKeys[0] ?? null,
      areaFilterConfig: config,
    },
  });

  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&areas_saved=1`);
}

export async function searchOrteAction(query: string, bundesland?: string) {
  await requireUser();
  const { searchOrte } = await import("@/lib/plz-reference");
  return searchOrte(query, bundesland?.trim() || undefined);
}

function areaDistrictRedirect(projectId: string, params: Record<string, string>): never {
  revalidatePath(`/project/${projectId}`);
  const query = new URLSearchParams({ tab: "map", ...params });
  redirect(`/project/${projectId}?${query.toString()}`);
}

export async function importProjectAreaDistrictsAction(
  projectId: string,
  tableRaw: string,
  plzScopeRaw?: string
) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const { parseLocationCatalogImport } = await import("@/lib/location-catalog-import");
  const {
    clearProjectAreaDistricts,
    clearProjectAreaDistrictsForPlzScope,
    replaceProjectAreaDistrictsForPlzScope,
    replaceProjectAreaDistrictsFromImport,
  } = await import("@/lib/project-area-data");

  const plzScope = plzScopeRaw
    ? [...new Set(plzScopeRaw.split(",").map((plz) => plz.trim()).filter((plz) => /^\d{5}$/.test(plz)))]
    : null;

  if (!tableRaw.trim()) {
    if (plzScope?.length) {
      await clearProjectAreaDistrictsForPlzScope(projectId, plzScope);
    } else {
      await clearProjectAreaDistricts(projectId);
    }
    areaDistrictRedirect(projectId, { districts_saved: "1", districts_cleared: "1" });
  }

  const parsed = parseLocationCatalogImport(tableRaw, "Import");
  if (!parsed) areaDistrictRedirect(projectId, { districts_error: "import" });

  const result = plzScope?.length
    ? await replaceProjectAreaDistrictsForPlzScope(projectId, parsed.rows, plzScope)
    : await replaceProjectAreaDistrictsFromImport(projectId, parsed.rows);
  areaDistrictRedirect(projectId, {
    districts_saved: "1",
    districts_plz: String(result.plzCount),
  });
}

export async function clearProjectAreaDistrictsAction(
  projectId: string,
  plzScopeRaw?: string
) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const { clearProjectAreaDistricts, clearProjectAreaDistrictsForPlzScope } = await import(
    "@/lib/project-area-data"
  );

  const plzScope = plzScopeRaw
    ? [...new Set(plzScopeRaw.split(",").map((plz) => plz.trim()).filter((plz) => /^\d{5}$/.test(plz)))]
    : null;

  if (plzScope?.length) {
    await clearProjectAreaDistrictsForPlzScope(projectId, plzScope);
  } else {
    await clearProjectAreaDistricts(projectId);
  }
  areaDistrictRedirect(projectId, { districts_saved: "1", districts_cleared: "1" });
}

export async function deleteProjectAreaDistrictAction(
  projectId: string,
  plzRaw: string,
  districtName: string
) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const plz = plzRaw.replace(/\D/g, "");
  const name = districtName.trim();
  if (!/^\d{5}$/.test(plz) || !name) {
    areaDistrictRedirect(projectId, { districts_error: "district" });
  }

  const { deleteProjectAreaDistrict } = await import("@/lib/project-area-data");
  await deleteProjectAreaDistrict(projectId, plz, name);
  areaDistrictRedirect(projectId, { districts_saved: "1" });
}

export async function reindexProjectDocumentsAction(projectId: string) {
  const user = await requireUser();

  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const { startProjectReindexJob } = await import("@/lib/project-reindex-jobs");
  const base = `/project/${projectId}?tab=settings`;
  try {
    await startProjectReindexJob(projectId, "documents");
  } catch (err) {
    if (err instanceof Error && err.message === "reindex_already_running") {
      redirect(`${base}&reindex_error=already_running&reindex_kind=documents`);
    }
    throw err;
  }

  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&reindex_started=documents`);
}

export async function reindexProjectAddressesAction(projectId: string) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const base = `/project/${projectId}?tab=settings`;
  const { startProjectReindexJob } = await import("@/lib/project-reindex-jobs");
  try {
    await startProjectReindexJob(projectId, "addresses");
  } catch (err) {
    if (err instanceof Error && err.message === "reindex_already_running") {
      redirect(`${base}&reindex_error=already_running&reindex_kind=addresses`);
    }
    throw err;
  }
  redirect(`${base}&reindex_started=addresses`);
}

export async function reindexProjectCommuteAction(projectId: string) {
  const user = await requireUser();

  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const { startProjectReindexJob } = await import("@/lib/project-reindex-jobs");
  const base = `/project/${projectId}?tab=settings`;
  try {
    await startProjectReindexJob(projectId, "commute");
  } catch (err) {
    if (err instanceof Error && err.message === "reindex_already_running") {
      redirect(`${base}&reindex_error=already_running&reindex_kind=commute`);
    }
    throw err;
  }

  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&reindex_started=commute`);
}

export async function archiveApartmentAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await prisma.apartment.findFirst({
    where: apartmentAccessWhere(apartmentId, user),
  });
  if (!apt) return;

  const archiveReason = parseArchiveReason(String(formData.get("archiveReason") ?? ""));
  if (!archiveReason) return;

  const archiveNote = parseArchiveNote(String(formData.get("archiveNote") ?? ""));

  await prisma.apartment.update({
    where: { id: apartmentId },
    data: {
      archivedAt: new Date(),
      archiveReason,
      archiveNote,
      revision: { increment: 1 },
    },
  });
  revalidatePath(`/project/${apt.projectId}`);
  revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
}

export async function unarchiveApartmentAction(apartmentId: string) {
  const user = await requireUser();
  const apt = await prisma.apartment.findFirst({
    where: apartmentAccessWhere(apartmentId, user),
  });
  if (!apt) return;
  await prisma.apartment.update({
    where: { id: apartmentId },
    data: {
      archivedAt: null,
      archiveReason: null,
      archiveNote: null,
      revision: { increment: 1 },
    },
  });
  revalidatePath(`/project/${apt.projectId}`);
  revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
}

export async function deleteApartmentAction(apartmentId: string) {
  const user = await requireUser();
  const apt = await prisma.apartment.findFirst({
    where: apartmentAccessWhere(apartmentId, user),
    select: { id: true, projectId: true, archivedAt: true },
  });
  if (!apt) redirect("/dashboard");

  try {
    await rm(join(getApartmentUploadsRoot(), apt.id), {
      recursive: true,
      force: true,
    });
  } catch {
    // upload folder may not exist
  }

  await prisma.apartment.delete({ where: { id: apartmentId } });
  revalidatePath(`/project/${apt.projectId}`);
  redirect(apt.archivedAt ? `/project/${apt.projectId}?tab=archived` : `/project/${apt.projectId}`);
}

export async function createApartmentAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`/project/${projectId}?tab=apartments&import_error=no_title`);
  }
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseInt(priceRaw.replace(/\D/g, ""), 10) : null;
  const address = String(formData.get("address") ?? "").trim() || null;

  const brokerInvolved = formData.get("brokerInvolved") === "on";
  const sizeSqmParsed = parseInt(String(formData.get("sizeSqm") ?? "").replace(/\D/g, ""), 10);
  const plotSizeSqmParsed = parseInt(
    String(formData.get("plotSizeSqm") ?? "").replace(/\D/g, ""),
    10
  );

  const apt = await prisma.apartment.create({
    data: {
      projectId,
      title,
      address,
      latitude: null,
      longitude: null,
      price: Number.isFinite(price) ? price : null,
      brokerInvolved,
      sizeSqm: Number.isFinite(sizeSqmParsed) ? sizeSqmParsed : null,
      plotSizeSqm: Number.isFinite(plotSizeSqmParsed) ? plotSizeSqmParsed : null,
      energyClass: parseEnergyClassInput(String(formData.get("energyClass") ?? "")),
      listingUrl: normalizeListingUrl(String(formData.get("listingUrl") ?? "")),
      description:
        String(formData.get("description") ?? "").trim().slice(0, 8000) || null,
    },
  });
  if (Number.isFinite(price) && price != null && price > 0) {
    await recordApartmentPriceChange(apt.id, price, null, PRICE_HISTORY_SOURCE_MANUAL);
  }
  if (address) {
    scheduleApartmentAddressEnrichment(apt.id);
  }
  revalidatePath(`/project/${projectId}`);
  redirect(`/project/${projectId}?tab=apartments`);
}

export async function updateApartmentBrokerAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);
  const brokerInvolved = formData.get("brokerInvolved") === "on";

  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, {
    brokerInvolved,
  });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`/project/${apt.projectId}/apartment/${apartmentId}?broker_saved=1`);
}

export async function updateApartmentTitleAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const title = String(formData.get("title") ?? "").trim();
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  if (!title) {
    redirect(`${base}?title_error=empty`);
  }

  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);
  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, { title });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?title_saved=1`);
}

export async function updateApartmentListingUrlAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const raw = String(formData.get("listingUrl") ?? "");
  const listingUrl = normalizeListingUrl(raw);
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  if (raw.trim() && !listingUrl) {
    redirect(`${base}?listing_error=invalid`);
  }

  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);
  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, {
    listingUrl,
  });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?listing_saved=1`);
}

async function geocodeApartmentAddressFields(
  address: string,
  existing?: { latitude: number | null; longitude: number | null }
) {
  const trimmed = address.trim();
  if (!trimmed) {
    return {
      address: null as string | null,
      latitude: null as number | null,
      longitude: null as number | null,
      resolved: true,
    };
  }
  const geocoded = await resolveApartmentGeocode(trimmed, existing);
  const applied = applyGeocodeToStoredAddress(trimmed, geocoded);
  return {
    address: applied.address || null,
    latitude: applied.latitude,
    longitude: applied.longitude,
    resolved: geocoded != null,
  };
}

export async function geocodeApartmentAddressAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const addressRaw = String(formData.get("address") ?? "").trim();
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  if (!addressRaw) {
    redirect(`${base}?address_geocode_failed=empty`);
  }

  const geocoded = await geocodeApartmentAddressFields(addressRaw, {
    latitude: apt.latitude,
    longitude: apt.longitude,
  });

  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);
  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, {
    address: geocoded.address,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
  });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);
  await invalidateCommuteCacheForApartment(apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
  revalidatePath(`/project/${apt.projectId}`);

  const redirectParams = new URLSearchParams();
  if (geocoded.resolved) {
    redirectParams.set("address_geocoded", "1");
  } else {
    redirectParams.set("address_geocode_failed", "1");
  }
  redirect(`${base}?${redirectParams.toString()}`);
}

export async function updateApartmentBasicsAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseInt(priceRaw.replace(/\D/g, ""), 10) : null;
  const addressRaw = String(formData.get("address") ?? "").trim();
  const storedAddress = addressRaw || null;
  const previousAddress = apt.address?.trim() ?? "";
  const addressChanged = (storedAddress?.trim() ?? "") !== previousAddress;
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;
  const sizeSqmRaw = String(formData.get("sizeSqm") ?? "").trim();
  const energyClassRaw = String(formData.get("energyClass") ?? "").trim();
  const sizeSqmParsed = sizeSqmRaw ? parseInt(sizeSqmRaw.replace(/\D/g, ""), 10) : null;
  const plotSizeSqmRaw = String(formData.get("plotSizeSqm") ?? "").trim();
  const plotSizeSqmParsed = plotSizeSqmRaw
    ? parseInt(plotSizeSqmRaw.replace(/\D/g, ""), 10)
    : null;
  const hoaFeeMonthly = parsePositiveInt(String(formData.get("hoaFeeMonthly") ?? ""));
  const heatingCostMonthly = parsePositiveInt(String(formData.get("heatingCostMonthly") ?? ""));
  const propertyTaxAnnual = parsePositiveInt(String(formData.get("propertyTaxAnnual") ?? ""));
  const renovationCost = parsePositiveInt(String(formData.get("renovationCost") ?? ""));
  const resolvedPrice = Number.isFinite(price) ? price : null;
  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);

  const current = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { price: true },
  });
  const previousPrice = current?.price ?? null;

  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, {
    price: resolvedPrice,
    address: storedAddress,
    ...(addressChanged && !storedAddress
      ? { latitude: null as number | null, longitude: null as number | null }
      : {}),
    sizeSqm: sizeSqmParsed != null && Number.isFinite(sizeSqmParsed) ? sizeSqmParsed : null,
    plotSizeSqm:
      plotSizeSqmParsed != null && Number.isFinite(plotSizeSqmParsed)
        ? plotSizeSqmParsed
        : null,
    energyClass: energyClassRaw ? parseEnergyClassInput(energyClassRaw) : null,
    hoaFeeMonthly,
    heatingCostMonthly,
    propertyTaxAnnual,
    renovationCost,
  });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);

  if (resolvedPrice !== previousPrice) {
    await recordApartmentPriceChange(
      apartmentId,
      resolvedPrice,
      previousPrice,
      PRICE_HISTORY_SOURCE_MANUAL
    );
  }
  if (addressChanged) {
    await invalidateCommuteCacheForApartment(apartmentId);
    if (storedAddress) {
      scheduleApartmentAddressEnrichment(apartmentId);
    }
  }
  revalidateApartment(apt.projectId, apartmentId);
  revalidatePath(`/project/${apt.projectId}`);
  redirect(`${base}?basics_saved=1`);
}

export async function updateApartmentNotesAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const raw = String(formData.get("notes") ?? "");
  const notes = raw.trim() || null;
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);
  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, { notes });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?notes_saved=1`);
}

export async function updateApartmentDescriptionAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) redirect("/dashboard");

  const raw = String(formData.get("description") ?? "");
  const description = raw.trim() || null;
  const base = `/project/${apt.projectId}/apartment/${apartmentId}`;

  const expectedRevision = requireRevisionFromForm(formData, apt.projectId, apartmentId);
  const ok = await updateApartmentIfRevisionMatches(apartmentId, expectedRevision, {
    description,
  });
  if (!ok) redirectApartmentRevisionConflict(apt.projectId, apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
  redirect(`${base}?description_saved=1`);
}

function uploadErrorFromCaught(e: unknown): UploadApartmentFileResult {
  if (e instanceof Error && isApartmentUploadError(e.message)) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: "invalid_type" };
}

export async function uploadApartmentDocumentAction(
  apartmentId: string,
  formData: FormData
): Promise<UploadApartmentFileResult | void> {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) return;

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await extractPdfText(buffer);
    const saved = await saveApartmentDocument(apartmentId, file, buffer);
    const count = await prisma.apartmentDocument.count({ where: { apartmentId } });
    await prisma.apartmentDocument.create({
      data: {
        apartmentId,
        fileName: saved.fileName,
        url: saved.url,
        mimeType: saved.mimeType,
        kind: "expose",
        extractedText,
        sortOrder: count,
      },
    });
    revalidateApartment(apt.projectId, apartmentId);
    return { ok: true };
  } catch (e) {
    return uploadErrorFromCaught(e);
  }
}

export async function deleteApartmentDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await prisma.apartmentDocument.findUnique({
    where: { id: documentId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!doc) return;
  const apt = await assertApartmentAccess(doc.apartmentId, user);
  if (!apt) return;

  await deleteApartmentPhotoFile(doc.url);
  await prisma.apartmentDocument.delete({ where: { id: documentId } });
  revalidateApartment(doc.apartment.projectId, doc.apartmentId);
}

export async function addViewingAction(apartmentId: string, formData: FormData) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) return;

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return;

  const note = String(formData.get("note") ?? "").trim() || null;
  await prisma.viewingAppointment.create({
    data: { apartmentId, scheduledAt, note },
  });
  await syncApartmentViewedAt(apartmentId);
  revalidateApartment(apt.projectId, apartmentId);
}

export async function updateViewingAction(viewingId: string, formData: FormData) {
  const user = await requireUser();
  const viewing = await prisma.viewingAppointment.findUnique({
    where: { id: viewingId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!viewing) return;
  const apt = await assertApartmentAccess(viewing.apartmentId, user);
  if (!apt) return;

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return;

  const note = String(formData.get("note") ?? "").trim() || null;
  await prisma.viewingAppointment.update({
    where: { id: viewingId },
    data: { scheduledAt, note },
  });
  await syncApartmentViewedAt(viewing.apartmentId);
  revalidateApartment(viewing.apartment.projectId, viewing.apartmentId);
}

export async function deleteViewingAction(viewingId: string) {
  const user = await requireUser();
  const viewing = await prisma.viewingAppointment.findUnique({
    where: { id: viewingId },
    include: { apartment: { select: { id: true, projectId: true } } },
  });
  if (!viewing) return;
  const apt = await assertApartmentAccess(viewing.apartmentId, user);
  if (!apt) return;

  await prisma.viewingAppointment.delete({ where: { id: viewingId } });
  await syncApartmentViewedAt(viewing.apartmentId);
  revalidateApartment(viewing.apartment.projectId, viewing.apartmentId);
}

export async function saveRatingAction(
  apartmentId: string,
  criterionId: string,
  score: number | null,
  note?: string | null
) {
  const user = await requireUser();
  const apt = await assertApartmentAccess(apartmentId, user);
  if (!apt) return;

  const criterion = await prisma.criterion.findFirst({
    where: { id: criterionId, group: { projectId: apt.projectId } },
    select: { id: true },
  });
  if (!criterion) return;

  if (score === null) {
    await prisma.rating.deleteMany({
      where: {
        apartmentId,
        criterionId,
        userId: user.id,
      },
    });
    revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
    revalidatePath(`/project/${apt.projectId}`);
    return;
  }

  if (!Number.isInteger(score) || score < 0 || score > 10) return;

  await prisma.rating.upsert({
    where: {
      apartmentId_criterionId_userId: {
        apartmentId,
        criterionId,
        userId: user.id,
      },
    },
    create: { apartmentId, criterionId, userId: user.id, score, note: note ?? null },
    update: { score, note: note ?? null },
  });
  revalidatePath(`/project/${apt.projectId}/apartment/${apartmentId}`);
  revalidatePath(`/project/${apt.projectId}`);
}

export async function updateCriterionAction(
  criterionId: string,
  data: { weight?: number; isDealbreaker?: boolean; name?: string }
) {
  const user = await requireUser();
  const c = await prisma.criterion.findUnique({
    where: { id: criterionId },
    include: { group: true },
  });
  if (!c) return;
  const group = await assertCriterionGroupAccess(c.groupId, user);
  if (!group) return;

  const update: typeof data = {};
  if (data.weight !== undefined) {
    if (!Number.isInteger(data.weight) || data.weight < 1 || data.weight > 5) return;
    update.weight = data.weight;
  }
  if (data.isDealbreaker !== undefined) update.isDealbreaker = data.isDealbreaker;
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return;
    update.name = name;
  }

  await prisma.criterion.update({ where: { id: criterionId }, data: update });
  revalidatePath(`/project/${c.group.projectId}`);
}

export async function deleteCriterionAction(criterionId: string) {
  const user = await requireUser();
  const c = await prisma.criterion.findUnique({
    where: { id: criterionId },
    include: { group: true },
  });
  if (!c) return;
  const group = await assertCriterionGroupAccess(c.groupId, user);
  if (!group) return;

  await prisma.criterion.delete({ where: { id: criterionId } });
  revalidatePath(`/project/${c.group.projectId}`);
}

export async function reorderCriteriaAction(groupId: string, orderedIds: string[]) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user);
  if (!group || orderedIds.length === 0) return;

  const existing = await prisma.criterion.findMany({
    where: { groupId },
    select: { id: true },
  });
  if (orderedIds.length !== existing.length) return;
  const idSet = new Set(existing.map((c) => c.id));
  if (!orderedIds.every((id) => idSet.has(id))) return;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.criterion.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
  revalidatePath(`/project/${group.projectId}`);
}

export async function addProjectMemberAction(projectId: string, formData: FormData) {
  const user = await requireUser();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const base = `/project/${projectId}?tab=team`;
  if (!username) redirect(base);

  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const invitee = await prisma.user.findUnique({ where: { username } });
  if (!invitee || isAdmin(invitee)) {
    redirect(`${base}&member_error=not_found`);
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: invitee.id } },
  });
  if (existing) {
    redirect(`${base}&member_error=already_member`);
  }

  await prisma.projectMember.create({
    data: { projectId, userId: invitee.id, role: "partner" },
  });
  revalidatePath(`/project/${projectId}`);
  redirect(`${base}&member_added=${encodeURIComponent(invitee.name)}`);
}

export async function removeProjectMemberAction(projectId: string, memberUserId: string) {
  const user = await requireUser();
  const base = `/project/${projectId}?tab=team`;

  const project = await assertProjectAccess(projectId, user);
  if (!project) redirect("/dashboard");

  const memberCount = await prisma.projectMember.count({ where: { projectId } });
  if (memberCount <= 1) {
    redirect(`${base}&member_error=last_member`);
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: memberUserId } },
    include: { user: { select: { name: true } } },
  });
  if (!membership) redirect(base);

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: memberUserId } },
  });
  revalidatePath(`/project/${projectId}`);

  if (memberUserId === user.id) {
    redirect("/dashboard");
  }
  redirect(`${base}&member_removed=${encodeURIComponent(membership.user.name)}`);
}

export async function addCriterionAction(projectId: string, groupId: string, name: string) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user);
  if (!group || !name.trim()) return;
  const max = await prisma.criterion.aggregate({
    where: { groupId },
    _max: { sortOrder: true },
  });
  await prisma.criterion.create({
    data: { groupId, name: name.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath(`/project/${projectId}`);
}

export async function createCriterionGroupAction(projectId: string, name: string) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project || !name.trim()) return;
  const max = await prisma.criterionGroup.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  await prisma.criterionGroup.create({
    data: {
      projectId,
      name: name.trim(),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/project/${projectId}`);
}

export async function updateCriterionGroupAction(groupId: string, name: string) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user);
  if (!group || !name.trim()) return;
  await prisma.criterionGroup.update({
    where: { id: groupId },
    data: { name: name.trim() },
  });
  revalidatePath(`/project/${group.projectId}`);
}

export async function deleteCriterionGroupAction(groupId: string) {
  const user = await requireUser();
  const group = await assertCriterionGroupAccess(groupId, user);
  if (!group) return;
  await prisma.criterionGroup.delete({ where: { id: groupId } });
  revalidatePath(`/project/${group.projectId}`);
}

export async function reorderCriterionGroupsAction(projectId: string, orderedIds: string[]) {
  const user = await requireUser();
  const project = await assertProjectAccess(projectId, user);
  if (!project || orderedIds.length === 0) return;

  const existing = await prisma.criterionGroup.findMany({
    where: { projectId },
    select: { id: true },
  });
  if (orderedIds.length !== existing.length) return;
  const idSet = new Set(existing.map((g) => g.id));
  if (!orderedIds.every((id) => idSet.has(id))) return;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.criterionGroup.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
  revalidatePath(`/project/${projectId}`);
}

export async function changeOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const pair = readPasswordPair(formData, "newPassword", "newPasswordConfirm");
  if (!pair.ok) {
    redirect(`/account/settings?error=${pair.error}`);
  }

  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, fresh.passwordHash))) {
    redirect("/account/settings?error=bad_current_password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(pair.password) },
  });
  revalidatePath("/account/settings");
  redirect("/account/settings?password_changed=1");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const pair = readPasswordPair(formData);
  if (!username || !name) {
    redirect("/admin?error=fields");
  }
  if (!pair.ok) {
    redirect(`/admin?error=${pair.error}`);
  }
  const password = pair.password;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) redirect("/admin?error=exists");
  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: await hashPassword(password),
      role: ROLE_USER,
    },
  });
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function deleteUserAction(userId: string) {
  const admin = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.id === admin.id) return;
  if (isAdmin(target)) {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) redirect("/admin?error=lastadmin");
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
}

function parseTransitArrivalTimeField(raw: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) {
    return {
      hour: parseTransitArrivalHour(null),
      minute: parseTransitArrivalMinute(null),
    };
  }
  return {
    hour: parseTransitArrivalHour(match[1]),
    minute: parseTransitArrivalMinute(match[2]),
  };
}

export async function updateTravelModeAction(formData: FormData) {
  const user = await requireUser();
  const travelMode = parseTravelMode(String(formData.get("travelMode") ?? ""));
  const companyCar = formData.get("companyCar") === "on";
  const companyCarRate = parseCompanyCarRate(String(formData.get("companyCarRate") ?? ""));
  const listPrice = parseListPriceEuros(String(formData.get("listPrice") ?? ""));
  const marginalTaxRatePercent = parseMarginalTaxRatePercent(
    String(formData.get("marginalTaxRatePercent") ?? "")
  );
  const companyCarCommuteMethod = parseCompanyCarCommuteMethod(
    String(formData.get("companyCarCommuteMethod") ?? "")
  );
  const companyCarOfficeTripsPerMonth = parseOfficeTripsPerMonth(
    String(formData.get("companyCarOfficeTripsPerMonth") ?? "")
  );
  const companyCarContributionEur = parseOptionalEuroAmount(
    String(formData.get("companyCarContributionEur") ?? "")
  );
  const companyCarSelfPaidCostsEur = parseOptionalEuroAmount(
    String(formData.get("companyCarSelfPaidCostsEur") ?? "")
  );
  const companyCarEmployerFuelCard = formData.get("companyCarEmployerFuelCard") === "on";
  const commuteAllowanceDaysPerYear = parseCommuteAllowanceDays(
    String(formData.get("commuteAllowanceDaysPerYear") ?? "")
  );
  const commuteAllowanceVacationDaysRaw = String(formData.get("commuteAllowanceVacationDays") ?? "").trim();
  const commuteAllowanceSickDaysRaw = String(formData.get("commuteAllowanceSickDays") ?? "").trim();
  const commuteAllowanceHomeOfficeDaysRaw = String(
    formData.get("commuteAllowanceHomeOfficeDays") ?? ""
  ).trim();
  const transitArrival = parseTransitArrivalTimeField(String(formData.get("transitArrivalTime") ?? ""));
  const transitArrivalWeekday = parseTransitArrivalWeekday(
    String(formData.get("transitArrivalWeekday") ?? "")
  );
  const transitFallbackMaxKm = parseTransitFallbackMaxKm(
    String(formData.get("transitFallbackMaxKm") ?? "")
  );
  const transitFallbackMode = parseTransitFallbackMode(
    String(formData.get("transitFallbackMode") ?? "")
  );

  const updateData: {
    travelMode: string;
    transitArrivalHour?: number;
    transitArrivalMinute?: number;
    transitArrivalWeekday?: number;
    transitFallbackMaxKm?: number | null;
    transitFallbackMode?: string | null;
    companyCar: boolean;
    companyCarRate: string | null;
    listPrice: number | null;
    marginalTaxRatePercent: number | null;
    companyCarCommuteMethod: string | null;
    companyCarOfficeTripsPerMonth: number | null;
    companyCarContributionEur: number | null;
    companyCarSelfPaidCostsEur: number | null;
    companyCarEmployerFuelCard: boolean;
    commuteAllowanceDaysPerYear: number | null;
    commuteAllowanceVacationDays: number | null;
    commuteAllowanceSickDays: number | null;
    commuteAllowanceHomeOfficeDays: number | null;
  } = {
    travelMode,
    companyCar: travelMode === "driving" ? companyCar : false,
      companyCarRate: travelMode === "driving" && companyCar ? companyCarRate : null,
      listPrice: travelMode === "driving" && companyCar ? listPrice : null,
      marginalTaxRatePercent:
        travelMode === "driving" && companyCar ? marginalTaxRatePercent : null,
      companyCarCommuteMethod:
        travelMode === "driving" && companyCar ? companyCarCommuteMethod : null,
      companyCarOfficeTripsPerMonth:
        travelMode === "driving" && companyCar && companyCarCommuteMethod === "trips"
          ? companyCarOfficeTripsPerMonth
          : null,
      companyCarContributionEur:
        travelMode === "driving" && companyCar ? Math.round(companyCarContributionEur) : null,
      companyCarSelfPaidCostsEur:
        travelMode === "driving" && companyCar ? Math.round(companyCarSelfPaidCostsEur) : null,
      companyCarEmployerFuelCard: travelMode === "driving" && companyCar ? companyCarEmployerFuelCard : true,
      commuteAllowanceDaysPerYear:
        travelMode === "driving" && companyCar ? commuteAllowanceDaysPerYear : null,
      commuteAllowanceVacationDays:
        travelMode === "driving" && companyCar
          ? commuteAllowanceVacationDaysRaw
            ? parseOptionalDayCount(commuteAllowanceVacationDaysRaw, resolveVacationDays(null))
            : null
          : null,
      commuteAllowanceSickDays:
        travelMode === "driving" && companyCar
          ? commuteAllowanceSickDaysRaw
            ? parseOptionalDayCount(commuteAllowanceSickDaysRaw, resolveSickDays(null))
            : null
          : null,
      commuteAllowanceHomeOfficeDays:
        travelMode === "driving" && companyCar
          ? commuteAllowanceHomeOfficeDaysRaw
            ? parseOptionalDayCount(commuteAllowanceHomeOfficeDaysRaw, resolveHomeOfficeDays(null))
            : null
          : null,
  };

  if (travelMode === "transit") {
    updateData.transitArrivalHour = transitArrival.hour;
    updateData.transitArrivalMinute = transitArrival.minute;
    updateData.transitArrivalWeekday = transitArrivalWeekday;
    updateData.transitFallbackMaxKm = transitFallbackMaxKm;
    updateData.transitFallbackMode = transitFallbackMode;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });
  await invalidateCommuteCacheForUser(user.id);
  revalidatePath("/account/settings");
  redirect("/account/settings?commute_saved=1");
}

async function geocodeUserAddressFields(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return { address: "", latitude: null as number | null, longitude: null as number | null };
  const coords = await geocodeAddress(trimmed);
  return {
    address: trimmed,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}

export async function createUserAddressAction(formData: FormData) {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();
  if (!label) redirect("/account/settings?error=label");
  if (!rawAddress) redirect("/account/settings?error=address");

  const geocoded = await geocodeUserAddressFields(rawAddress);
  const isWorkplace = formData.get("isWorkplace") === "on";
  const maxOrder = await prisma.userAddress.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  });

  await prisma.userAddress.create({
    data: {
      userId: user.id,
      label,
      address: geocoded.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      isWorkplace,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/account/settings");
  redirect("/account/settings?address_saved=1");
}

export async function updateUserAddressAction(addressId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!existing) redirect("/account/settings");

  const label = String(formData.get("label") ?? "").trim();
  const rawAddress = String(formData.get("address") ?? "").trim();
  if (!label) redirect("/account/settings?error=label");
  if (!rawAddress) redirect("/account/settings?error=address");

  const geocoded = await geocodeUserAddressFields(rawAddress);
  const isWorkplace = formData.get("isWorkplace") === "on";

  await prisma.userAddress.update({
    where: { id: addressId },
    data: {
      label,
      address: geocoded.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      isWorkplace,
    },
  });
  await invalidateCommuteCacheForUserAddress(addressId);
  revalidatePath("/account/settings");
  redirect("/account/settings?address_saved=1");
}

export async function deleteUserAddressAction(addressId: string) {
  const user = await requireUser();
  const existing = await prisma.userAddress.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!existing) redirect("/account/settings");

  await prisma.userAddress.delete({ where: { id: addressId } });
  revalidatePath("/account/settings");
  redirect("/account/settings?address_deleted=1");
}

export async function resetUserPasswordAction(userId: string, formData: FormData) {
  await requireAdmin();
  const pair = readPasswordPair(formData);
  if (!pair.ok) {
    redirect(`/admin?error=${pair.error}`);
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirect("/admin");
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(pair.password) },
  });
  revalidatePath("/admin");
  redirect(`/admin?password_reset=${encodeURIComponent(target.username)}`);
}
