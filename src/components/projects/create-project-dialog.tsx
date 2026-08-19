"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createProject } from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";
import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validations/project";

const SAAS_BLUEPRINT = `Build a production-ready multi-tenant SaaS application.

PRODUCT
- Purpose: [describe the problem and target customer]
- Plans: Free, Pro, and Business

ROLES
- Workspace Owner: billing, settings, team, and all records
- Administrator: operational management
- Member: assigned work only
- Platform Administrator: system health and account oversight

CORE WORKFLOWS
1. Sign up, create a workspace, choose a plan, and complete onboarding.
2. Create, search, update, and archive the primary business records.
3. Invite team members and assign role-based permissions.
4. Upgrade, downgrade, or cancel a Stripe subscription.

DATA AND SECURITY
- Use Supabase Auth, PostgreSQL, and owner/workspace-scoped Row-Level Security.
- Generate foreign keys, indexes, constraints, and SELECT/INSERT/UPDATE/DELETE policies.
- Authenticate and authorize every query and mutation server-side.

PRODUCT QUALITY
- Use real persistent CRUD; never use in-memory arrays or fake data storage.
- Include responsive navigation, onboarding, search, filters, pagination, and export.
- Include loading, empty, validation, error, success, disabled, and retry states.
- Integrate Stripe Checkout, verified webhooks, and the customer portal.
- Generate environment examples, migrations, setup documentation, and tests.

ACCEPTANCE CRITERIA
- Records persist after refresh and are isolated by workspace.
- Every role sees only authorized pages and records.
- Billing status is verified server-side.
- No placeholder pages, non-functional buttons, missing imports, or undeclared dependencies.`;

export function CreateProjectDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "", prompt: "" },
  });
  const promptValue =
    useWatch({ control: form.control, name: "prompt" }) ?? "";

  function onSubmit(values: CreateProjectInput) {
    startTransition(async () => {
      const result = await createProject(values);
      // On success the action redirects to the new workspace, so only
      // errors ever come back.
      if (result && "error" in result) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            New project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Start with a short idea or paste a complete product specification.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My awesome app" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="A short description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FormLabel>
                        What do you want to build?{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </FormLabel>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            form.setValue("prompt", SAAS_BLUEPRINT, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          <Sparkles />
                          SaaS blueprint
                        </Button>
                        {promptValue.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              form.setValue("prompt", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            aria-label="Clear app specification"
                          >
                            <Trash2 />
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Describe users, workflows, pages, data, integrations, security, and acceptance criteria…"
                        className="min-h-64 max-h-[42dvh] resize-y [field-sizing:fixed]"
                        maxLength={MAX_AI_PROMPT_CHARACTERS}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FormDescription className="flex items-center gap-1.5">
                        <FileText className="size-3.5" />
                        Detailed specifications produce stronger applications.
                      </FormDescription>
                      <span
                        className="text-muted-foreground text-xs tabular-nums"
                        aria-live="polite"
                      >
                        {promptValue.length.toLocaleString()} /{" "}
                        {MAX_AI_PROMPT_CHARACTERS.toLocaleString()}
                      </span>
                    </div>
                    <details className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
                      <summary className="text-foreground cursor-pointer font-medium">
                        What should a strong app specification include?
                      </summary>
                      <p className="mt-2 leading-5">
                        Purpose, users and permissions, complete workflows,
                        pages, database tables, integrations, security rules,
                        loading and error states, and testable acceptance
                        criteria.
                      </p>
                    </details>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="bg-background shrink-0 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Create project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
