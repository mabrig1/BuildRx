import { createHmac } from "crypto";

type ConversionPayload = {
  id: string;
  type: "purchase" | "quote_request" | "email_reply" | "referral" | "pricing_visit";
  email: string;
  amount?: number;
  currency?: string;
  attributionToken?: string;
  product?: string;
  reference?: string;
  occurredAt?: string;
  source?: string;
};

function endpoint() {
  const base = process.env.MABRIG_GROWTH_BASE_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/api/conversions/generic` : "";
}

export function isMabrigGrowthConfigured() {
  return Boolean(endpoint() && process.env.MABRIG_GROWTH_SHARED_SECRET);
}

export async function reportMabrigConversion(payload: ConversionPayload) {
  const url = endpoint();
  const secret = process.env.MABRIG_GROWTH_SHARED_SECRET?.trim();
  if (!url || !secret) return { reported: false, reason: "not-configured" as const };

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mabrig-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("MABRIG Growth conversion report rejected:", response.status, detail.slice(0, 300));
      return { reported: false, reason: "remote-rejected" as const };
    }

    return { reported: true as const };
  } catch (error) {
    console.warn("MABRIG Growth conversion report failed:", error);
    return { reported: false, reason: "network-error" as const };
  }
}
