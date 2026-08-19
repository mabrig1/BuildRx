import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { plans } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free with 5 projects. Upgrade to Pro for unlimited projects and higher AI limits.",
};

export default function PricingPage() {
  return (
    <>
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center md:py-24">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            Start free, no credit card required. Upgrade when your ideas
            outgrow the limits.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 px-4 py-16 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.id === "pro" ? "border-primary shadow-md" : undefined
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.id === "pro" ? <Badge>Popular</Badge> : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="pt-2">
                  <span className="text-4xl font-semibold tabular-nums">
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm"> /month</span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="grid gap-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="text-primary size-4 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.id === "pro" ? "default" : "outline"}
                  asChild
                >
                  <Link href="/signup">
                    {plan.id === "pro" ? "Start with Pro" : "Start free"}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-t">
        <div className="mx-auto w-full max-w-3xl px-4 py-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Questions
          </h2>
          <dl className="grid gap-6 text-sm leading-relaxed">
            <div>
              <dt className="font-medium">Can I try it without paying?</dt>
              <dd className="text-muted-foreground mt-1">
                Yes — the Free plan includes 5 projects and monthly AI
                requests, forever. No credit card required.
              </dd>
            </div>
            <div>
              <dt className="font-medium">How do payments work?</dt>
              <dd className="text-muted-foreground mt-1">
                Pro is billed monthly via Paystack or Flutterwave. Invoices
                appear in your billing dashboard, and you can cancel any time —
                access continues until the end of the paid period.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Do I own the code?</dt>
              <dd className="text-muted-foreground mt-1">
                Completely. Push it to your GitHub, download it as a zip, or
                deploy it to your own Vercel, Netlify, or Railway account.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}
