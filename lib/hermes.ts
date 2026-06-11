// Hermes — the orchestration brain wiring SAHJONY's frontend command interface
// to the backend subsystems. A single natural-language command is classified by
// the model into a structured action, then executed against the REAL system
// (deals, finder, buyers, CRM, workforce, memory). Outbound/irreversible
// actions (email/whatsapp/docusign/calls) are never auto-run — Hermes returns a
// confirmation proposal instead.

import { complete, extractJson } from "./infer";
import { listDeals, listBuyers, upsertBuyer, matchBuyers, analyzeDeal } from "./wholesale";
import { addMemory } from "./memory-store";
import { runFinder } from "./finder";
import { WORKERS, newTask, saveTask } from "./workforce";
import { sourceDealFromAddress } from "./source-deal";

export interface HermesResult {
  action: string;
  ok: boolean;
  speak: string;       // natural-language summary for voice/UI
  data?: unknown;
  needsConfirmation?: { kind: string; reason: string; params: Record<string, unknown> };
}

const ACTIONS = `Available actions and their params:
- create_lead {address, city?, state?, arv?, repairs?, contractPrice?, fee?} — add a deal lead
- find_deals {} — run the autonomous deal finder once
- add_buyer {name, type?, markets?(array), minPrice?, maxPrice?, minBeds?} — add a cash buyer
- match_deal {address} — list buyers matching a deal
- analyze_deal {address} — MAO/grade for a deal
- pipeline {} — pipeline KPIs
- assign_worker {workerId(one of: acquisitions,dispo,analyst,coordinator,developer,ea), task} — delegate to a worker
- remember {text, tag?} — store a durable memory
- draft_email {to?, prompt} — draft an email (NOT sent)
- send_outbound {channel(email|whatsapp|docusign|call), to, summary} — requires confirmation; DO NOT assume consent
- answer {text} — just answer conversationally`;

const SYSTEM = `You are Hermes, SAHJONY's orchestration brain. Convert the user's command into EXACTLY ONE JSON action.
${ACTIONS}
Return only JSON: {"action": "...", "params": { ... }, "speak": "one short sentence confirming what you're doing"}.
Pick the single best action. Never invent property data (ARV/comps) — leave unknown numbers out.`;

export async function hermes(command: string): Promise<HermesResult> {
  const res = await complete([
    { role: "system", content: SYSTEM },
    { role: "user", content: command },
  ]);
  const plan = res ? extractJson<{ action: string; params: any; speak?: string }>(res.content) : null;
  if (!plan?.action) {
    return { action: "answer", ok: false, speak: "I couldn't parse that into an action, sir." };
  }
  const p = plan.params ?? {};
  const speak = plan.speak ?? "Working on it.";

  try {
    switch (plan.action) {
      case "create_lead": {
        if (!p.address) return { action: plan.action, ok: false, speak: "Give me an address and I'll source it, sir." };
        // Reconstruct a full address (model may split out city/state) so the
        // Census geocoder can match it.
        const fullAddr = [p.address, p.city, p.state].filter(Boolean).join(", ");
        // Autonomous: just the address — Hermes pulls every real field it can.
        const sourced = await sourceDealFromAddress(fullAddr, {
          arv: Number(p.arv) || 0, estRepairs: Number(p.repairs) || 0,
          contractPrice: Number(p.contractPrice) || 0, fee: Number(p.fee) || 0,
        });
        return { action: plan.action, ok: true, speak: sourced.summary, data: sourced };
      }
      case "find_deals": {
        const run = await runFinder();
        return { action: plan.action, ok: true, speak: run.note, data: run };
      }
      case "add_buyer": {
        const buyer = await upsertBuyer({
          name: String(p.name ?? "Unnamed"), type: p.type ?? "individual",
          box: { markets: Array.isArray(p.markets) ? p.markets : [], propertyTypes: [], minPrice: Number(p.minPrice) || 0, maxPrice: Number(p.maxPrice) || 0, minBeds: Number(p.minBeds) || 0, maxRepairs: 0, strategy: "any" },
        });
        return { action: plan.action, ok: true, speak, data: buyer };
      }
      case "match_deal": {
        const deal = (await listDeals()).find((d) => d.address.toLowerCase().includes(String(p.address ?? "").toLowerCase()));
        if (!deal) return { action: plan.action, ok: false, speak: "No matching deal found, sir." };
        const matches = matchBuyers(deal, await listBuyers());
        return { action: plan.action, ok: true, speak: `${matches.length} buyers fit that deal.`, data: matches.slice(0, 8) };
      }
      case "analyze_deal": {
        const deal = (await listDeals()).find((d) => d.address.toLowerCase().includes(String(p.address ?? "").toLowerCase()));
        if (!deal) return { action: plan.action, ok: false, speak: "No matching deal found, sir." };
        return { action: plan.action, ok: true, speak, data: analyzeDeal(deal) };
      }
      case "pipeline": {
        const deals = await listDeals();
        const inFlight = deals.filter((d) => d.status === "under_contract" || d.status === "assigned");
        return { action: plan.action, ok: true, speak,
          data: { deals: deals.length, buyers: (await listBuyers()).length, projectedFees: inFlight.reduce((s, d) => s + (d.desiredFee || 0), 0) } };
      }
      case "assign_worker": {
        const worker = WORKERS.find((w) => w.id === p.workerId) ?? WORKERS[0];
        const t = newTask(worker.id, String(p.task ?? command));
        const r = await complete([{ role: "system", content: worker.system }, { role: "user", content: t.task }]);
        t.result = r?.content ?? "Brain unreachable."; t.status = r ? "done" : "error";
        await saveTask(t);
        return { action: plan.action, ok: true, speak: `${worker.name} handled it.`, data: t };
      }
      case "remember": {
        const m = await addMemory(String(p.text ?? command), String(p.tag ?? "general"));
        return { action: plan.action, ok: true, speak: "Noted and remembered.", data: m };
      }
      case "draft_email": {
        const r = await complete([
          { role: "system", content: "You are SAHJONY's EA. Draft a clear email. First line 'Subject: ...'. No invented facts." },
          { role: "user", content: `${p.prompt ?? command}${p.to ? `\nTo: ${p.to}` : ""}` },
        ]);
        return { action: plan.action, ok: true, speak: "Draft ready for your review.", data: { draft: r?.content } };
      }
      case "send_outbound":
        return { action: plan.action, ok: true, speak: `Ready to ${p.channel ?? "send"} — confirm to proceed, sir.`,
          needsConfirmation: { kind: String(p.channel ?? "outbound"), reason: "Outbound contact requires your go-ahead.", params: p } };
      case "answer":
      default: {
        // Capability-aware conversation so SAHJONY never denies its own systems.
        const r = await complete([
          { role: "system", content:
            "You are SAHJONY, the orchestration brain (Hermes engine) of this control plane and of SAHJONY CAPITAL LLC (real-estate wholesaling). " +
            "You ARE fully integrated — you run on Hermes as both the frontend command interface and the backend engine. " +
            "Your live systems: deal pipeline + analyzer (ARV/MAO/grade), cash-buyer network with buying-box matching, autonomous 24/7 deal finder (licensed MLS RESO), " +
            "address/photo enrichment (Census/Regrid/public+court records), native CRM, joint ventures, AI workforce (Vera/Marcus/Priya/Dana/Ada/Jeeves), " +
            "email agent, DocuSign e-sign, WhatsApp, Bland.ai calls, persistent memory, and an owner-authorized browser/device control agent. " +
            "Never claim a system is missing or unintegrated — it is all wired. Address the user as 'sir', be concise and precise." },
          { role: "user", content: command },
        ]);
        return { action: "answer", ok: true, speak: r?.content ?? plan.speak ?? "At your service, sir." };
      }
    }
  } catch (e) {
    return { action: plan.action, ok: false, speak: `That action failed: ${(e as Error).message}` };
  }
}
