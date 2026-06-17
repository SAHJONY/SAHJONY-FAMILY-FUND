import Link from "next/link";
import FundDashboard from "@/components/FundDashboard";

export const metadata = { title: "SAHJONY Family Fund" };

export default function FundPage() {
  return (
    <main className="min-h-screen p-4 md:p-6 max-w-[1500px] mx-auto">
      <div className="mb-4">
        <Link href="/" className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--hud)]">‹ Control Plane</Link>
      </div>
      <FundDashboard />
    </main>
  );
}
