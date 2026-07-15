import type { Metadata } from "next";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
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
import { Progress } from "@/components/ui/progress";
import { plans } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Billing",
};

export default function BillingPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and usage."
      />

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>
            Your AI message usage for the current billing period.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">AI messages</span>
            <span className="font-medium tabular-nums">0 / 50</span>
          </div>
          <Progress value={0} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === "free";
          const isFeatured = plan.id === "pro";

          return (
            <Card
              key={plan.id}
              className={isFeatured ? "border-primary shadow-md" : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : isFeatured ? (
                    <Badge>Popular</Badge>
                  ) : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="pt-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm"> /month</span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="grid gap-2 text-sm">
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
                  variant={isFeatured ? "default" : "outline"}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current plan" : `Upgrade to ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
