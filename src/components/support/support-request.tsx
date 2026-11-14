"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, LifeBuoy, Mail, MessageCircle, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_TOPICS,
  supportEmailUrl,
  supportWhatsAppUrl,
  validSupportDraft,
  type SupportDraft,
  type SupportIssue,
} from "@/lib/support/support-messages";

export function SupportRequest() {
  const [ticketPending, setTicketPending] = useState(false);
  const [savedTicketId, setSavedTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupportDraft>({
    issue: "paid-course", name: "", email: "", reference: "", description: "",
  });
  const topic = SUPPORT_TOPICS.find(t => t.id === draft.issue)!;
  const valid = validSupportDraft(draft);
  const whatsapp = useMemo(() => supportWhatsAppUrl(draft), [draft]);
  const email = useMemo(() => supportEmailUrl(draft), [draft]);

  function change<K extends keyof SupportDraft>(field: K, value: SupportDraft[K]) {
    setSavedTicketId(null);
    setDraft(previous => ({ ...previous, [field]: value }));
  }

  async function createTrackedTicket() {
    if (!valid || ticketPending) return;
    setTicketPending(true);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.issue,
          message: draft.description.trim(),
          reference: draft.reference.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ticketId) {
        throw new Error(data?.error ?? "Unable to save support ticket");
      }
      setSavedTicketId(data.ticketId);
      toast.success("Your private support ticket was created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create ticket");
    } finally {
      setTicketPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LifeBuoy className="size-5" /> Describe the problem</CardTitle>
          <CardDescription>Choose a topic and describe your issue. Signed-in customers can submit a private tracked support ticket, or prepare a WhatsApp/email message. WhatsApp/email messages are not sent automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="support-topic">Support topic</Label>
            <select id="support-topic" className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
              value={draft.issue} onChange={e => change("issue", e.target.value as SupportIssue)}>
              {SUPPORT_TOPICS.map(t => <option value={t.id} key={t.id}>{t.title}</option>)}
            </select>
          </div>
          <p className="text-muted-foreground text-sm">{topic.hint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="support-name">Your name (optional)</Label>
              <Input id="support-name" autoComplete="name" value={draft.name} maxLength={80}
                onChange={e => change("name", e.target.value)} placeholder="Your name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support-email">Your BuildRx account email (optional)</Label>
              <Input id="support-email" type="email" autoComplete="email" value={draft.email} maxLength={150}
                onChange={e => change("email", e.target.value)} placeholder="student@example.com" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="support-reference">Payment reference / project name (optional)</Label>
            <Input id="support-reference" value={draft.reference} maxLength={140}
              onChange={e => change("reference", e.target.value)} placeholder="Reference or project title" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="support-description">What happened? (minimum 12 characters)</Label>
            <Textarea id="support-description" rows={5} maxLength={1200} value={draft.description}
              placeholder="What did you try, what did you expect, and what happened instead?"
              onChange={e => change("description", e.target.value)} />
            <span className="text-muted-foreground text-right text-xs">{draft.description.length}/1200</span>
          </div>
          <div role="note" className="bg-muted/40 flex gap-2 rounded-md border p-3 text-xs">
            <ShieldAlert className="size-4 shrink-0" />
            <p>Never send passwords, OTPs, secret recovery links, API keys, full card numbers, bank PINs, private identity documents or sensitive client data. WhatsApp/email are external services; check your message before sending.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {valid ? (
              <>
                <Button className="flex-1" asChild>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-1 size-4" /> Prepare WhatsApp message <ArrowUpRight className="size-4" />
                  </a>
                </Button>
                <Button className="flex-1" variant="outline" asChild>
                  <a href={email}><Mail className="mr-1 size-4" /> Prepare support email</a>
                </Button>
              </>
            ) : (
              <>
                <Button className="flex-1" disabled><MessageCircle className="mr-1 size-4" /> Prepare WhatsApp message</Button>
                <Button className="flex-1" variant="outline" disabled><Mail className="mr-1 size-4" /> Prepare support email</Button>
              </>
            )}
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-semibold">Create a tracked BuildRx support ticket</p>
            <p className="text-muted-foreground text-xs">
              Available to signed-in BuildRx customers. Your verified account is linked to the request, and only you and platform administrators may view it.
              A submission creates a ticket but does not send a WhatsApp message.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={createTrackedTicket}
                disabled={!valid || ticketPending || Boolean(savedTicketId)}>
                {ticketPending ? "Submitting..." : savedTicketId ? "Ticket created" : "Submit private ticket"}
              </Button>
              <Link href="/login?next=/support" className="text-primary text-xs underline underline-offset-4">Sign in first</Link>
            </div>
            {savedTicketId ? <p role="status" className="break-all text-sm">
              Ticket received: <strong>{savedTicketId}</strong>. Your request is now in the administrator support inbox.
            </p> : null}
          </div>
          <p className="text-muted-foreground text-xs">WhatsApp/email messages must be sent by you. Ticket submission stores your issue privately. No response-time guarantee is made.</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Safe next steps</CardTitle>
            <CardDescription>Start here before contacting support about {topic.title.toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-3 text-sm">
              {topic.nextSteps.map(step => <li key={step}>{step}</li>)}
            </ol>
            {draft.issue === "account" ? (
              <Button className="mt-4" size="sm" variant="outline" asChild><Link href="/forgot-password">Open password recovery <ArrowUpRight className="size-4" /></Link></Button>
            ) : null}
            {draft.issue === "paid-course" ? (
              <Button className="mt-4" size="sm" variant="outline" asChild><Link href="/course">Open Academy enrollment <ArrowUpRight className="size-4" /></Link></Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Support channels</CardTitle>
            <CardDescription>Official MABRIG Technologies contact points</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>WhatsApp:</strong> <a className="underline underline-offset-4" href="https://wa.me/2347065342818" target="_blank" rel="noopener noreferrer">+234 706 534 2818</a></p>
            <p><strong>Email:</strong> <a className="underline underline-offset-4" href="mailto:contact@mabrigkorie.org">contact@mabrigkorie.org</a></p>
            <p className="text-muted-foreground text-xs">For urgent account issues, reset your password and protect your credentials before reaching out.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
