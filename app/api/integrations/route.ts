import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Reports which integrations are actually configured. Returns NO secrets —
// only whether a key/number is present, so the UI can show real connection
// state. Configure values on the /env page.
export async function GET() {
  return NextResponse.json(
    {
      bland: {
        connected: !!process.env.BLAND_API_KEY,
        detail: process.env.BLAND_API_KEY ? "Bland.ai key present." : "Set BLAND_API_KEY to connect.",
      },
      googleVoice: {
        number: process.env.GOOGLE_VOICE_NUMBER || null,
        detail: process.env.GOOGLE_VOICE_NUMBER
          ? "Click-to-call enabled. (Google Voice has no public API — manual/dialer only.)"
          : "Set GOOGLE_VOICE_NUMBER to enable click-to-call.",
      },
      propstream: {
        url: process.env.PROPSTREAM_URL || "https://login.propstream.com",
        detail: "Launch link. PropStream has no public API; export CSV and import here.",
      },
      regrid: {
        connected: !!process.env.REGRID_API_TOKEN,
        detail: process.env.REGRID_API_TOKEN
          ? "Regrid connected — real parcel data auto-fills on Auto-find."
          : "Set REGRID_API_TOKEN for real nationwide parcel data (owner/APN/assessed value).",
      },
      docusign: {
        connected: !!(process.env.DOCUSIGN_BASE_URI && process.env.DOCUSIGN_ACCOUNT_ID && process.env.DOCUSIGN_TOKEN),
        detail: "E-sign contracts via email or embedded online signing. Set DOCUSIGN_BASE_URI/ACCOUNT_ID/TOKEN.",
      },
      whatsapp: {
        connected: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
        detail: "WhatsApp Business Cloud API (Meta). Set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID.",
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
