import { redirect } from "next/navigation";
import { ApartmentSolarAr } from "@/components/ApartmentSolarAr";
import { getAppTimeZone } from "@/lib/app-settings";
import { getSessionUser } from "@/lib/auth";
import { getApartmentForUser } from "@/lib/project-data";
import { parseOptionalDateQuery } from "@/lib/solar-seasons";

export default async function ApartmentSolarArPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; aptId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id: projectId, aptId } = await params;
  const { date: dateQuery } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const apartment = await getApartmentForUser(projectId, aptId, user);
  if (!apartment) redirect(`/project/${projectId}`);

  const timeZone = await getAppTimeZone();
  const backHref = `/project/${projectId}/apartment/${aptId}`;

  const initialDayDate = parseOptionalDateQuery(dateQuery) ?? new Date();

  return (
    <ApartmentSolarAr
      apartmentId={aptId}
      backHref={backHref}
      title={apartment.title}
      timeZone={timeZone}
      initialDayDate={initialDayDate}
    />
  );
}
