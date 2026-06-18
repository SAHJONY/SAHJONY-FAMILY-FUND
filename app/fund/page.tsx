import FundApp from "@/components/FundApp";

export const metadata = {
  title: "SAHJONY CAPITAL LLC",
  description: "SAHJONY CAPITAL LLC — deterministic multi-asset monitor & quant trading lab · www.sahjonycapital.com",
};

export default async function FundPage() {
  // Try to fetch the signed‑in user; fall back to guest if not logged in.
  let user = { id: "guest", name: "Guest", email: "", plan: "free" as const, isOwner: false } as const;
  try {
    const r = await fetch("/api/auth", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (j.user) user = j.user;
    }
  } catch {}

  // If still a guest (not signed in) we prompt to log in.
  if (user.id === "guest") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl mb-4">Sign in to access Pro features</h2>
          <a href="/login" className="px-4 py-2 bg-[var(--gold)] text-black rounded hover:bg-[var(--gold-dark)]">Log In</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-[1500px] mx-auto">
      <FundApp user={user} />
    </main>
  );
}
