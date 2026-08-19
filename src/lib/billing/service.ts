import type { BillingProvider } from "@/lib/billing/providers";
import { planById, plans } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Billing state plumbing: activation, summary, and the demo store. */

export interface InvoiceRecord {
  id: string;
  provider: string;
  reference: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
}

export interface BillingSummary {
  plan: "free" | "pro";
  status: string;
  provider: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    projects: number;
    projectLimit: number; // Infinity for unlimited
    aiRequestsThisMonth: number;
    aiRequestLimit: number;
  };
  invoices: InvoiceRecord[];
  demo: boolean;
}

// ------------------------------------------------------------------
// Demo store
// ------------------------------------------------------------------

interface DemoBilling {
  plan: "free" | "pro";
  provider: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  invoices: InvoiceRecord[];
}

const globalDemo = globalThis as unknown as {
  __appCreatorBilling?: DemoBilling;
};

export function demoBilling(): DemoBilling {
  globalDemo.__appCreatorBilling ??= {
    plan: "free",
    provider: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    invoices: [],
  };
  return globalDemo.__appCreatorBilling;
}

export function demoActivatePro(provider: BillingProvider): void {
  const state = demoBilling();
  const pro = planById("pro");
  state.plan = "pro";
  state.provider = provider;
  state.cancelAtPeriodEnd = false;
  state.currentPeriodEnd = new Date(Date.now() + 30 * 864e5).toISOString();
  state.invoices.unshift({
    id: `inv_demo_${Date.now()}`,
    provider,
    reference: `ref_${Math.random().toString(36).slice(2, 10)}`,
    plan: "pro",
    amount: pro.price,
    currency: process.env.BILLING_CURRENCY ?? "USD",
    status: "paid",
    paidAt: new Date().toISOString(),
  });
}

// ------------------------------------------------------------------
// Activation (requires the service-role key: subscriptions, invoices,
// and users.plan are deliberately not client-writable)
// ------------------------------------------------------------------

export async function activateProSubscription(params: {
  userId: string;
  provider: BillingProvider;
  reference: string;
  amount: number;
  currency: string;
  paidAt: string;
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to activate subscriptions."
    );
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString();
  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: params.userId,
        plan: "pro",
        status: "active",
        provider: params.provider,
        provider_ref: params.reference,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();
  if (subError) throw new Error(subError.message);

  // Idempotent invoice insert (reference is unique).
  await admin.from("invoices").upsert(
    {
      user_id: params.userId,
      subscription_id: subscription?.id ?? null,
      provider: params.provider,
      reference: params.reference,
      plan: "pro",
      amount: params.amount,
      currency: params.currency,
      status: "paid",
      paid_at: params.paidAt,
    },
    { onConflict: "reference", ignoreDuplicates: true }
  );

  await admin.from("users").update({ plan: "pro" }).eq("id", params.userId);
}

// ------------------------------------------------------------------
// Summary for the billing dashboard
// ------------------------------------------------------------------

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getBillingSummary(
  userId: string | null
): Promise<BillingSummary> {
  if (!isSupabaseConfigured() || !userId) {
    const state = demoBilling();
    const limits = planById(state.plan).limits;
    return {
      plan: state.plan,
      status: state.plan === "pro" ? "active" : "free",
      provider: state.provider,
      currentPeriodEnd: state.currentPeriodEnd,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      usage: {
        projects: 1,
        projectLimit: limits.projects,
        aiRequestsThisMonth: 12,
        aiRequestLimit: limits.aiRequestsPerMonth,
      },
      invoices: state.invoices,
      demo: true,
    };
  }

  const supabase = await createClient();
  const [subscription, projectCount, aiUsage, invoices] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "plan, status, provider, current_period_end, cancel_at_period_end"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    // Scope to the user's own rows — visible rows under RLS also include
    // public/team projects (and everything, for admins), which would
    // misreport usage against the personal plan limits shown here.
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId),
    supabase
      .from("usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("action", ["ai_message", "ai_generation"])
      .gte("created_at", monthStartIso()),
    supabase
      .from("invoices")
      .select(
        "id, provider, reference, plan, amount, currency, status, paid_at"
      )
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const active =
    subscription.data &&
    ["active", "trialing"].includes(subscription.data.status);
  const plan = active ? subscription.data!.plan : "free";
  const limits = planById(plan).limits;

  return {
    plan: plan as "free" | "pro",
    status: subscription.data?.status ?? "free",
    provider: subscription.data?.provider ?? null,
    currentPeriodEnd: subscription.data?.current_period_end ?? null,
    cancelAtPeriodEnd: subscription.data?.cancel_at_period_end ?? false,
    usage: {
      projects: projectCount.count ?? 0,
      projectLimit: limits.projects,
      aiRequestsThisMonth: aiUsage.count ?? 0,
      aiRequestLimit: limits.aiRequestsPerMonth,
    },
    invoices: (invoices.data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      reference: row.reference,
      plan: row.plan,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      paidAt: row.paid_at,
    })),
    demo: false,
  };
}

export { plans };
