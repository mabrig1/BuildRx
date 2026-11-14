import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  BillingError,
  flutterwaveInitialize,
  isFlutterwaveConfigured,
  isPaystackConfigured,
  paystackInitialize,
} from "@/lib/billing/providers";
import {
  COURSE_PRICE_NGN,
  COURSE_SLUG,
  COURSE_TITLE,
} from "@/lib/course/buildrx-tech-plus";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  provider: z.enum(["paystack", "flutterwave"]),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Enrollment is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_slug", COURSE_SLUG)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ url: "/course" });
  }

  const provider = parsed.data.provider;
  const configured =
    provider === "paystack" ? isPaystackConfigured() : isFlutterwaveConfigured();

  if (!configured) {
    return NextResponse.json(
      {
        error:
          provider +
          " is not configured. Add the provider secret key before accepting course payments.",
      },
      { status: 503 }
    );
  }

  // Do not trust a caller-supplied Origin header for financial redirects.
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = configuredUrl ? new URL(configuredUrl) : new URL(request.url);
  if (!["https:", "http:"].includes(appUrl.protocol)) {
    return NextResponse.json({ error: "Invalid checkout configuration" }, { status: 503 });
  }
  const reference = "techplus_" + user.id + "_" + randomUUID();
  const callbackUrl = new URL("/api/course/verify?provider=" + provider, appUrl.origin).toString();
  const metadata = {
    user_id: user.id,
    product: COURSE_SLUG,
    product_name: COURSE_TITLE,
    purchase_type: "one_time_course",
  };

  try {
    const init =
      provider === "paystack"
        ? await paystackInitialize({
            email: user.email,
            amount: COURSE_PRICE_NGN,
            currencyCode: "NGN",
            reference,
            callbackUrl,
            metadata,
            includePlanCode: false,
          })
        : await flutterwaveInitialize({
            email: user.email,
            amount: COURSE_PRICE_NGN,
            currencyCode: "NGN",
            reference,
            callbackUrl,
            metadata,
            title: COURSE_TITLE,
          });

    return NextResponse.json({ url: init.checkoutUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BillingError
            ? error.message
            : "Failed to start course checkout",
      },
      { status: 502 }
    );
  }
}
