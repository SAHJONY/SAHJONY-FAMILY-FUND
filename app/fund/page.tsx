import FundApp from "@/components/FundApp";

export const metadata = {
  title: "SAHJONY CAPITAL LLC",
  description: "SAHJONY CAPITAL LLC — deterministic multi-asset monitor & quant trading lab · www.sahjonycapital.com",
};

// Open access: no authentication required.
export default async function FundPage() {
  // Guest user placeholder – no auth required.
  const guestUser = { id: "guest", name: "Guest", email: "", plan: "free" as const, isOwner: false };

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-[1500px] mx-auto">
      <FundApp user={guestUser} />
    </main>
  );
}
