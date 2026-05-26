import { redirect } from "next/navigation";
import { ApartmentSolarAr } from "@/components/ApartmentSolarAr";
import { getAppTimeZone } from "@/lib/app-settings";
import { getSessionUser } from "@/lib/auth";
import { getApartmentForUser } from "@/lib/project-data";

export default async function ApartmentSolarArPage({
  params,
}: {
  params: Promise<{ id: string; aptId: string }>;
}) {
  const { id: projectId, aptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const apartment = await getApartmentForUser(projectId, aptId, user);
  if (!apartment) redirect(`/project/${projectId}`);

  if (apartment.latitude == null || apartment.longitude == null) {
    redirect(`/project/${projectId}/apartment/${aptId}`);
  }

  const timeZone = await getAppTimeZone();
  const backHref = `/project/${projectId}/apartment/${aptId}`;

  return (
    <ApartmentSolarAr
      backHref={backHref}
      title={apartment.title}
      latitude={apartment.latitude}
      longitude={apartment.longitude}
      timeZone={timeZone}
    />
  );
}
