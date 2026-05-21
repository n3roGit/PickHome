import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ApartmentChecklist } from "@/components/ApartmentChecklist";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  buildApartmentChecklistGroups,
  buildBrokerQuestionsDigest,
  filterChecklistItemsForUser,
} from "@/lib/checklist-display";
import {
  getApartmentForUser,
  getProjectChecklistBrokerGroups,
  getProjectChecklistItems,
  getProjectMetaForUser,
} from "@/lib/project-data";

export default async function ApartmentChecklistPage({
  params,
}: {
  params: Promise<{ id: string; aptId: string }>;
}) {
  const { id: projectId, aptId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const project = await getProjectMetaForUser(projectId, user);
  if (!project) redirect("/dashboard");

  const apartment = await getApartmentForUser(projectId, aptId, user);
  if (!apartment) redirect(`/project/${projectId}`);

  const [checklistItems, brokerGroups] = await Promise.all([
    getProjectChecklistItems(projectId),
    getProjectChecklistBrokerGroups(projectId),
  ]);
  const brokerDigest = buildBrokerQuestionsDigest(brokerGroups);
  const visibleItems = filterChecklistItemsForUser(checklistItems, user.id);
  const entries = apartment.checklistEntries.map((e) => ({
    itemId: e.itemId,
    status: e.status,
    note: e.note,
  }));

  const { groups } = buildApartmentChecklistGroups(visibleItems, entries, user.id);

  const partnerViews = project.members
    .filter((m) => m.userId !== user.id)
    .map((m) => {
      const partnerItems = filterChecklistItemsForUser(checklistItems, m.userId);
      const built = buildApartmentChecklistGroups(partnerItems, entries, m.userId);
      return {
        userId: m.userId,
        name: m.user.name,
        groups: built.groups,
        brokerDigest,
      };
    });

  const admin = isAdmin(user);
  const addressLine = apartment.address?.trim();

  return (
    <>
      <Nav userName={user.name} isAdmin={admin} />
      <main className="max-w-lg mx-auto px-4 py-6 sm:py-8 flex-1 min-w-0 w-full">
        <Link
          href={`/project/${projectId}/apartment/${aptId}`}
          className="text-sm text-pn-text-secondary hover:text-pn-accent mb-4 inline-block"
        >
          ← Zurück zur Wohnung
        </Link>
        <h1 className="text-xl font-bold m-0">Checkliste</h1>
        <p className="text-sm text-pn-text-secondary mt-1 mb-6">
          {apartment.title}
          {addressLine ? ` · ${addressLine}` : ""}
        </p>

        <ApartmentChecklist
          apartmentId={aptId}
          groups={groups}
          brokerDigest={brokerDigest}
          partners={partnerViews}
        />
      </main>
      <Footer />
    </>
  );
}
