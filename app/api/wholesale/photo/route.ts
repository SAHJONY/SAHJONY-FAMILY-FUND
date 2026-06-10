import { NextRequest, NextResponse } from "next/server";
import exifr from "exifr";
import { regridByPoint, regridConnected } from "@/lib/regrid";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Photo → address, the real & legal way.
//
// Reads the GPS coordinates embedded by the camera in a photo YOU took (EXIF),
// then reverse-geocodes them to a real street address via OpenStreetMap
// Nominatim. If the photo has no GPS, it says so — it does NOT guess a
// stranger's address from visual features (that would be doxxing). With an
// address in hand it pulls real Regrid parcel data when connected.

const UA = "SAHJONY-ControlPlane/1.0 (real-estate due diligence; owner-supplied photos)";

async function reverseGeocode(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const dataUrl = String(body.image ?? "");
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  if (!b64) return NextResponse.json({ error: "image (base64 / data URL) required" }, { status: 400 });

  let buf: Buffer;
  try { buf = Buffer.from(b64, "base64"); } catch { return NextResponse.json({ error: "invalid image data" }, { status: 400 }); }

  let gps: { latitude?: number; longitude?: number } | null = null;
  try { gps = await exifr.gps(buf); } catch { gps = null; }

  if (!gps || gps.latitude == null || gps.longitude == null) {
    return NextResponse.json({
      located: false,
      detail:
        "No GPS location is embedded in this photo. SAHJONY locates from the GPS your camera saved — it won't guess an address from how a house looks. Re-shoot with location enabled, or type the address.",
    });
  }

  const lat = gps.latitude, lon = gps.longitude;
  const rev = await reverseGeocode(lat, lon);
  const address = rev?.display_name ?? null;
  const a = rev?.address ?? {};
  const city = a.city || a.town || a.village || a.hamlet || "";
  const state = a.state || "";
  const county = a.county || "";

  let regrid = null;
  if (regridConnected()) {
    const r = await regridByPoint(lat, lon);
    regrid = r.ok ? { connected: true, ...r.parcel } : { connected: true, error: r.detail };
  }

  return NextResponse.json({
    located: true,
    coordinates: { lat, lon },
    address,
    city,
    state,
    county,
    regrid,
    detail: address
      ? "Located from the photo's own GPS, then reverse-geocoded (OpenStreetMap). Verify before acting."
      : "GPS found, but no street address matched the coordinates.",
  });
}
