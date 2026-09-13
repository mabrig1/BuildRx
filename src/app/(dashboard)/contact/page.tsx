import type { Metadata } from "next";
import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { brandConfig, brandContactLinks } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact MABRIG Technologies",
  description: "Official contact and support channels for BuildRx and MABRIG Technologies.",
};

function ContactIcon({ label }: { label: string }) {
  if (label === "WhatsApp") return <MessageCircle className="size-5" />;
  if (label === "Phone") return <Phone className="size-5" />;
  if (label === "Email" || label === "Contact") return <Mail className="size-5" />;
  return <ExternalLink className="size-5" />;
}

export default function ContactPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact MABRIG Technologies"
        description="Official support, business, social and product channels for BuildRx."
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>{brandConfig.ownershipLine}</CardTitle>
          <CardDescription>
            {brandConfig.supportLine}. Use any verified channel below for support,
            partnerships, training, product enquiries or business communication.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {brandContactLinks.map((contact) => (
          <Card key={contact.href}>
            <CardHeader className="pb-3">
              <div className="text-primary mb-2">
                <ContactIcon label={contact.label} />
              </div>
              <CardTitle className="text-base">{contact.label}</CardTitle>
              <CardDescription className="break-all">
                {"value" in contact ? contact.value : contact.label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={contact.href}
                  target={contact.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    contact.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  Open
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
