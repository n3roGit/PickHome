import "../helpers/action-mocks-setup";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addCriterionAction,
  addProjectMemberAction,
  createCriterionGroupAction,
  deleteCriterionAction,
  deleteCriterionGroupAction,
  removeProjectMemberAction,
  reorderCriteriaAction,
  reorderCriterionGroupsAction,
  updateCriterionAction,
  updateCriterionGroupAction,
} from "@/app/actions";
import { toggleChecklistCriterionAction } from "@/app/checklist-actions";
import {
  catchRedirect,
  clearMockAuth,
  setMockUser,
} from "../helpers/action-mocks";
import {
  addTestProjectMember,
  clearProjectData,
  createTestPartner,
  createTestPrisma,
  createTestProject,
  resetTestDatabase,
} from "../helpers/test-db";

describe("members and criteria server actions", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    const prisma = createTestPrisma();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearMockAuth();
    const prisma = createTestPrisma();
    await clearProjectData(prisma);
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    setMockUser(user);
    await prisma.$disconnect();
  });

  it("addProjectMemberAction rejects unknown user", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);

    const form = new FormData();
    form.set("username", "nobody");

    const { redirect } = await catchRedirect(() =>
      addProjectMemberAction(project.id, form)
    );
    expect(redirect).toContain("member_error=not_found");
    await prisma.$disconnect();
  });

  it("addProjectMemberAction rejects duplicate member", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const partner = await createTestPartner(prisma);
    const project = await createTestProject(prisma, user.id);
    await addTestProjectMember(prisma, project.id, partner.id);

    const form = new FormData();
    form.set("username", partner.username);

    const { redirect } = await catchRedirect(() =>
      addProjectMemberAction(project.id, form)
    );
    expect(redirect).toContain("member_error=already_member");
    await prisma.$disconnect();
  });

  it("addProjectMemberAction adds partner", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const partner = await createTestPartner(prisma, "invite", "Invite User");
    const project = await createTestProject(prisma, user.id);

    const form = new FormData();
    form.set("username", "invite");

    const { redirect } = await catchRedirect(() =>
      addProjectMemberAction(project.id, form)
    );
    expect(redirect).toContain("member_added=");

    const count = await prisma.projectMember.count({ where: { projectId: project.id } });
    expect(count).toBe(2);
    await prisma.$disconnect();
  });

  it("removeProjectMemberAction blocks removing last member", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);

    const { redirect } = await catchRedirect(() =>
      removeProjectMemberAction(project.id, user.id)
    );
    expect(redirect).toContain("member_error=last_member");
    await prisma.$disconnect();
  });

  it("removeProjectMemberAction redirects self to dashboard", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const partner = await createTestPartner(prisma, "partner-leave", "Partner Leave");
    const project = await createTestProject(prisma, user.id);
    await addTestProjectMember(prisma, project.id, partner.id);
    setMockUser(partner);

    const { redirect } = await catchRedirect(() =>
      removeProjectMemberAction(project.id, partner.id)
    );
    expect(redirect).toBe("/dashboard");
    await prisma.$disconnect();
  });

  it("manages criterion groups and criteria", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);

    await createCriterionGroupAction(project.id, "Extra");
    const group = await prisma.criterionGroup.findFirst({
      where: { projectId: project.id, name: "Extra" },
    });
    expect(group).not.toBeNull();

    await addCriterionAction(project.id, group!.id, "New criterion");
    const criterion = await prisma.criterion.findFirst({
      where: { groupId: group!.id, name: "New criterion" },
    });
    expect(criterion).not.toBeNull();

    await updateCriterionGroupAction(group!.id, "Renamed");
    await updateCriterionAction(criterion!.id, { weight: 4, name: " Renamed crit " });
    const updated = await prisma.criterion.findUniqueOrThrow({ where: { id: criterion!.id } });
    expect(updated.weight).toBe(4);
    expect(updated.name).toBe("Renamed crit");

    await deleteCriterionGroupAction(group!.id);
    const deleted = await prisma.criterionGroup.findUnique({ where: { id: group!.id } });
    expect(deleted).toBeNull();
    await prisma.$disconnect();
  });

  it("reorderCriterionGroupsAction updates sortOrder", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const g1 = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "A", sortOrder: 0 },
    });
    const g2 = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "B", sortOrder: 1 },
    });

    await reorderCriterionGroupsAction(project.id, [g2.id, g1.id]);
    const ordered = await prisma.criterionGroup.findMany({
      where: { projectId: project.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(ordered.map((g) => g.id)).toEqual([g2.id, g1.id]);
    await prisma.$disconnect();
  });

  it("reorderCriterionGroupsAction ignores invalid id lists", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const g1 = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "Only", sortOrder: 0 },
    });

    await reorderCriterionGroupsAction(project.id, [g1.id, "fake-id"]);
    const row = await prisma.criterionGroup.findUniqueOrThrow({ where: { id: g1.id } });
    expect(row.sortOrder).toBe(0);
    await prisma.$disconnect();
  });

  it("deleteCriterionAction removes linked checklist items", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "G", sortOrder: 0 },
    });
    const c = await prisma.criterion.create({
      data: { groupId: group.id, name: "Checklist linked", sortOrder: 0 },
    });

    await toggleChecklistCriterionAction(project.id, c.id, true);
    await deleteCriterionAction(c.id);

    const item = await prisma.checklistItem.findUnique({ where: { criterionId: c.id } });
    const criterion = await prisma.criterion.findUnique({ where: { id: c.id } });
    expect(item).toBeNull();
    expect(criterion).toBeNull();
    await prisma.$disconnect();
  });

  it("updateCriterionAction rename is visible via checklist item relation", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "G", sortOrder: 0 },
    });
    const c = await prisma.criterion.create({
      data: { groupId: group.id, name: "Old name", sortOrder: 0 },
    });

    await toggleChecklistCriterionAction(project.id, c.id, true);
    await updateCriterionAction(c.id, { name: "New name" });

    const item = await prisma.checklistItem.findUnique({
      where: { criterionId: c.id },
      include: { criterion: true },
    });
    expect(item?.criterion?.name).toBe("New name");
    await prisma.$disconnect();
  });

  it("deleteCriterionAction removes a single criterion", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "G", sortOrder: 0 },
    });
    const c1 = await prisma.criterion.create({
      data: { groupId: group.id, name: "Keep", sortOrder: 0 },
    });
    const c2 = await prisma.criterion.create({
      data: { groupId: group.id, name: "Remove", sortOrder: 1 },
    });

    await deleteCriterionAction(c2.id);
    const remaining = await prisma.criterion.findMany({ where: { groupId: group.id } });
    expect(remaining.map((c) => c.id)).toEqual([c1.id]);
    await prisma.$disconnect();
  });

  it("reorderCriteriaAction updates sortOrder within a group", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "G", sortOrder: 0 },
    });
    const c1 = await prisma.criterion.create({
      data: { groupId: group.id, name: "A", sortOrder: 0 },
    });
    const c2 = await prisma.criterion.create({
      data: { groupId: group.id, name: "B", sortOrder: 1 },
    });

    await reorderCriteriaAction(group.id, [c2.id, c1.id]);
    const ordered = await prisma.criterion.findMany({
      where: { groupId: group.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(ordered.map((c) => c.id)).toEqual([c2.id, c1.id]);
    await prisma.$disconnect();
  });

  it("reorderCriteriaAction ignores invalid id lists", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "G", sortOrder: 0 },
    });
    const c1 = await prisma.criterion.create({
      data: { groupId: group.id, name: "Only", sortOrder: 0 },
    });

    await reorderCriteriaAction(group.id, [c1.id, "fake-id"]);
    const row = await prisma.criterion.findUniqueOrThrow({ where: { id: c1.id } });
    expect(row.sortOrder).toBe(0);
    await prisma.$disconnect();
  });

  it("updateCriterionAction rejects invalid weight", async () => {
    const prisma = createTestPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { username: "testuser" } });
    const project = await createTestProject(prisma, user.id);
    const group = await prisma.criterionGroup.create({
      data: { projectId: project.id, name: "G", sortOrder: 0 },
    });
    const c = await prisma.criterion.create({
      data: { groupId: group.id, name: "C", weight: 3, sortOrder: 0 },
    });

    await updateCriterionAction(c.id, { weight: 9 });
    const row = await prisma.criterion.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.weight).toBe(3);
    await prisma.$disconnect();
  });
});
