import { NextRequest, NextResponse } from "next/server";
import { listDeals } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DocuSign e-signature — sends the assignment/contract for signature using the
// owner's OWN DocuSign account (DOCUSIGN_BASE_URI, DOCUSIGN_ACCOUNT_ID,
// DOCUSIGN_TOKEN — an OAuth access token, set on /env). Two delivery modes:
//   - "email": DocuSign emails the signer a signing link (remote signing)
//   - "embedded": returns a recipient view URL to sign online in-app
// Real DocuSign eSignature REST API; nothing simulated. Consent required.

function cfg() {
  return {
    base: process.env.DOCUSIGN_BASE_URI, // e.g. https://demo.docusign.net/restapi
    account: process.env.DOCUSIGN_ACCOUNT_ID,
    token: process.env.DOCUSIGN_TOKEN,
  };
}

export async function GET() {
  const { base, account, token } = cfg();
  return NextResponse.json({ connected: !!(base && account && token) });
}

export async function POST(req: NextRequest) {
  const { base, account, token } = cfg();
  if (!base || !account || !token) {
    return NextResponse.json({ error: "DocuSign not connected. Set DOCUSIGN_BASE_URI, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_TOKEN on the env page." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.consent) return NextResponse.json({ error: "Set consent:true to send for signature." }, { status: 403 });

  const deal = (await listDeals()).find((d) => d.id === body.dealId);
  const signerEmail = String(body.signerEmail ?? "").trim();
  const signerName = String(body.signerName ?? "Signer").trim();
  const mode = body.mode === "embedded" ? "embedded" : "email";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail)) {
    return NextResponse.json({ error: "Valid signer email required." }, { status: 400 });
  }

  // Minimal HTML document to sign (the assignment summary). Real businesses can
  // swap in the generated contract HTML.
  const docHtml = Buffer.from(
    `<html><body><h2>Assignment of Contract</h2><p>Property: ${deal?.address ?? body.documentTitle ?? "Agreement"}</p>` +
    `<p>Assignment fee: $${(deal?.desiredFee ?? 0).toLocaleString()}</p><p>Sign below.</p>` +
    `<p>Signature: <span style="color:white">**signature_1**</span></p></body></html>`
  ).toString("base64");

  const envelope: any = {
    emailSubject: body.subject || `Please sign: ${deal?.address ?? "Assignment of Contract"}`,
    documents: [{ documentBase64: docHtml, name: "Assignment.html", fileExtension: "html", documentId: "1" }],
    recipients: {
      signers: [{
        email: signerEmail, name: signerName, recipientId: "1", routingOrder: "1",
        ...(mode === "embedded" ? { clientUserId: "sahjony-embed-1" } : {}),
        tabs: { signHereTabs: [{ anchorString: "**signature_1**", anchorXOffset: "0", anchorYOffset: "0", anchorUnits: "pixels" }] },
      }],
    },
    status: "sent",
  };

  try {
    const create = await fetch(`${base.replace(/\/$/, "")}/v2.1/accounts/${account}/envelopes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
    const env = await create.json();
    if (!create.ok) return NextResponse.json({ error: "DocuSign error", detail: env }, { status: 502 });

    if (mode === "embedded" && env.envelopeId) {
      const view = await fetch(`${base.replace(/\/$/, "")}/v2.1/accounts/${account}/envelopes/${env.envelopeId}/views/recipient`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: body.returnUrl || "http://localhost:3000/deals", authenticationMethod: "none", email: signerEmail, userName: signerName, clientUserId: "sahjony-embed-1" }),
      });
      const v = await view.json();
      return NextResponse.json({ ok: true, mode, envelopeId: env.envelopeId, signingUrl: v.url ?? null });
    }
    return NextResponse.json({ ok: true, mode: "email", envelopeId: env.envelopeId, detail: "DocuSign emailed the signer a signing link." });
  } catch (e) {
    return NextResponse.json({ error: `DocuSign send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
