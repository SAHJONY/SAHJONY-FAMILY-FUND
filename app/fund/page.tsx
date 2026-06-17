import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, getUser, publicUser } from "@/lib/fund/auth";
import FundApp from "@/components/FundApp";

export const metadata = {
  title: "SAHJONY CAPITAL LLC",
  description: "SAHJONY CAPITAL LLC — deterministic multi-asset monitor & quant trading lab · www.sahjonycapital.com",
};

// Guarded: requires a valid session, else redirect to /login.
export default async function FundPage() {
  const token = (await cookies()).get("sahjony_sid")?.value;
  const userId = verifySession(token);
  if (!userId) redirect("/login");
  const u = await getUser(userId);
  if (!u || u.status === "suspended") redirect("/login");
  const pu = publicUser(u);

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-[1500px] mx-auto">
      <FundApp user={{ id: pu.id, name: pu.name, email: pu.email, plan: pu.plan, isOwner: pu.isOwner }} />
    </main>
  );
}
