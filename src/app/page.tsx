import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin");
  redirect("/dashboard");
}
