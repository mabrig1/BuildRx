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
    return NextResponse.json({ simulated: true, url: "/course?enrolled=1" });
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

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const reference = "techplus_" + user.id.slice(0, 8) + "_" + Date.now();
  const callbackUrl = origin + "/api/course/verify?provider=" + provider;
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
