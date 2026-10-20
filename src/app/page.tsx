import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    const count = await prisma.user.count();
    redirect(count === 0 ? "/configurar" : "/login");
  }
  redirect("/projetos");
}
