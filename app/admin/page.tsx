import Link from "next/link";
import OwnerConsole from "@/components/OwnerConsole";

export const metadata = { title: "SAHJONY CAPITAL LLC · Owner Console" };

export default function AdminPage() {
  return (
    <main className="min-h-screen p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/" className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--hud)]">‹ Control Plane</Link>
        <Link href="/fund" className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--hud)]">‹ Fund</Link>
      </div>
      <OwnerConsole />
    </main>
  );
}
