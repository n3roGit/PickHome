import { describe, expect, it } from "vitest";
import { ROLE_ADMIN, ROLE_USER } from "@/lib/auth";
import {
  activeProjectsListWhere,
  apartmentAccessWhere,
  projectAccessWhere,
} from "@/lib/project-access";

describe("project-access", () => {
  const member = { id: "u1", role: ROLE_USER };
  const admin = { id: "a1", role: ROLE_ADMIN };

  it("scopes projects to membership for regular users", () => {
    expect(projectAccessWhere("p1", member)).toEqual({
      id: "p1",
      members: { some: { userId: "u1" } },
    });
    expect(activeProjectsListWhere(member)).toEqual({
      members: { some: { userId: "u1" } },
      archivedAt: null,
    });
    expect(apartmentAccessWhere("apt1", member)).toEqual({
      id: "apt1",
      project: { members: { some: { userId: "u1" } } },
    });
  });

  it("allows admins to access any project and apartment", () => {
    expect(projectAccessWhere("p1", admin)).toEqual({ id: "p1" });
    expect(activeProjectsListWhere(admin)).toEqual({ archivedAt: null });
    expect(apartmentAccessWhere("apt1", admin)).toEqual({ id: "apt1" });
  });
});
