import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  BillingError,
  flutterwaveInitialize,
  isFlutterwaveConfigured,
  isPaystackConfigured,
  paystackInitialize,
} from "@/lib/billing/providers";
import { demoActivatePro } from "@/lib/billing/service";
import { planById } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  plan: z.literal("pro"),
  provider: z.enum(["paystack", "flutterwave"]),
});

/** POST — start a hosted checkout for the Pro plan. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { provider } = parsed.data;
  const pro = planById("pro");

  // Demo mode: activate immediately, no real charge.
  if (!isSupabaseConfigured()) {
    demoActivatePro(provider);
    return NextResponse.json({
      simulated: true,
      url: "/billing?upgraded=1",
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured =
    provider === "paystack" ? isPaystackConfigured() : isFlutterwaveConfigured();
  if (!configured) {
    return NextResponse.json(
      {
        error: `${provider} is not configured — set the ${provider === "paystack" ? "PAYSTACK_SECRET_KEY" : "FLUTTERWAVE_SECRET_KEY"} environment variable.`,
      },
      { status: 503 }
    );
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const reference = `appcreator_${user.id.slice(0, 8)}_${Date.now()}`;
  const callbackUrl = `${origin}/api/billing/verify?provider=${provider}`;

  try {
    const init =
      provider === "paystack"
        ? await paystackInitialize({
            email: user.email,
            amount: pro.price,
            reference,
            callbackUrl,
            metadata: { user_id: user.id, plan: "pro" },
          })
        : await flutterwaveInitialize({
            email: user.email,
            amount: pro.price,
            reference,
            callbackUrl,
            metadata: { user_id: user.id, plan: "pro" },
          });
    return NextResponse.json({ url: init.checkoutUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BillingError
            ? error.message
            : "Failed to start checkout",
      },
      { status: 502 }
    );
  }
}
