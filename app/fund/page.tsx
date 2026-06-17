import Link from "next/link";
import FundDashboard from "@/components/FundDashboard";
import StrategyLab from "@/components/StrategyLab";

export const metadata = {
  title: "SAHJONY CAPITAL LLC",
  description: "SAHJONY CAPITAL LLC — deterministic multi-asset monitor & quant trading lab · www.sahjonycapital.com",
};

export default function FundPage() {
  return (
    <main className="min-h-screen p-4 md:p-6 max-w-[1500px] mx-auto">
      <div className="mb-4">
        <Link href="/" className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--hud)]">‹ Control Plane</Link>
      </div>
      <FundDashboard />
      <div className="my-8 border-t border-[rgba(63,224,255,0.15)]" />
      <StrategyLab />
    </main>
  );
}
