"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FileText, LayoutTemplate, Loader2, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { APP_STARTERS } from "@/lib/projects/app-starters";
import { EasyBriefBuilder } from "@/components/projects/easy-brief-builder";
import { GITHUB_APP_TEMPLATES } from "@/lib/projects/github-app-templates";
import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";
import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validations/project";

export function CreateProjectDialog({
  trigger,
  defaultValues,
  demoMode = false,
}: {
  trigger?: React.ReactNode;
  defaultValues?: Partial<CreateProjectInput>;
  demoMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedStarter, setSelectedStarter] = useState<string | null>(null);
  const [starterSearch, setStarterSearch] = useState("");
  const [starterCategory, setStarterCategory] = useState("All");
  const [importingGithub, setImportingGithub] = useState<string | null>(null);
  const initialValues: CreateProjectInput = {
    name: defaultValues?.name ?? "",
    description: defaultValues?.description ?? "",
    prompt: defaultValues?.prompt ?? "",
  };

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: initialValues,
  });
  const promptValue = form.watch("prompt") ?? "";
  const starterCategories = ["All", ...Array.from(new Set(APP_STARTERS.map((s) => s.category ?? "Other"))).sort()];
  const starterResults = APP_STARTERS.filter((starter) => {
    const categoryMatches = starterCategory === "All" || (starter.category ?? "Other") === starterCategory;
    const text = `${starter.name} ${starter.description} ${starter.audience}`.toLowerCase();
    return categoryMatches && text.includes(starterSearch.trim().toLowerCase());
  });

  function applyStarter(id: string) {
    const starter = APP_STARTERS.find((item) => item.id === id);
    if (!starter) return;
    // Preserve explicitly supplied names/descriptions; only fill blank
    // fields or the name/description from the previous starter choice.
    const previous = APP_STARTERS.find((item) => item.id === selectedStarter);
    const name = form.getValues("name").trim();
    const description = (form.getValues("description") ?? "").trim();
    if (!name || (previous && name === previous.name)) {
      form.setValue("name", starter.name, { shouldDirty: true, shouldValidate: true });
    }
    if (!description || (previous && description === previous.description)) {
      form.setValue("description", starter.description, { shouldDirty: true, shouldValidate: true });
    }
    form.setValue("prompt", starter.prompt, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setSelectedStarter(id);
  }

  async function importGithubTemplate(templateId: string) {
    if (demoMode) {
      toast.error("Sign in to clone real GitHub source into a permanent app project.");
      return;
    }
    setImportingGithub(templateId);
    try {
      const response = await fetch("/api/projects/import-github-starter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.projectId) {
        throw new Error(data.error ?? "Unable to import this template");
      }
      toast.success("Source imported. Review and customize before publishing.");
      window.location.assign(`/projects/${encodeURIComponent(data.projectId)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub import failed");
    } finally {
      setImportingGithub(null);
    }
  }

  function onSubmit(values: CreateProjectInput) {
    if (demoMode) {
      const id = `demo-${crypto.randomUUID()}`;
      try {
        window.sessionStorage.setItem(
          `buildrx-demo-draft:${id}`,
          JSON.stringify({
            name: values.name,
            prompt: values.prompt ?? "",
          })
        );
      } catch {
        toast.error("Your browser blocked temporary storage. Please enable session storage to open a draft with its specification.");
        return;
      }
      window.location.assign(`/projects/${id}`);
      return;
    }
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
        if (!next) {
          form.reset(initialValues);
          setSelectedStarter(null);
        }
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
            Answer three simple questions to describe your app, choose a proven starter, or customize your own detailed brief.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {demoMode && (
                <p role="status" className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-900/20 dark:text-amber-100">
                  Demo mode: drafts stay in this browser session. Generated files are temporary on the server; connect a database before creating real customer projects.
                </p>
              )}
              <EasyBriefBuilder onUse={(result) => {
                const existingName = form.getValues("name").trim();
                if (!existingName) form.setValue("name", result.name, { shouldValidate: true, shouldDirty: true });
                const existingDescription = (form.getValues("description") ?? "").trim();
                if (!existingDescription) form.setValue("description", result.description, { shouldValidate: true, shouldDirty: true });
                form.setValue("prompt", result.prompt, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                setSelectedStarter(null);
              }} />
              <section aria-label="Starter app ideas" className="space-y-2">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Choose a starting point</h3>
                  <span className="text-muted-foreground text-xs">Optional</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={starterSearch}
                    onChange={(event) => setStarterSearch(event.target.value)}
                    placeholder="Search app ideas (school, POS, church, booking...)"
                    aria-label="Search app starters"
                    className="min-w-40 flex-1"
                  />
                  <select
                    aria-label="Filter app category"
                    value={starterCategory}
                    onChange={(event) => setStarterCategory(event.target.value)}
                    className="bg-background h-9 max-w-full rounded-md border px-2 text-sm"
                  >
                    {starterCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <p className="text-muted-foreground text-xs" role="status">
                  Showing {starterResults.length} of {APP_STARTERS.length} app ideas.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {starterResults.map((starter) => (
                    <button
                      key={starter.id}
                      type="button"
                      aria-pressed={selectedStarter === starter.id}
                      onClick={() => applyStarter(starter.id)}
                      className={`relative min-h-24 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedStarter === starter.id ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/30"}`}
                    >
                      {selectedStarter === starter.id && <Check className="text-primary absolute right-2 top-2 size-4" aria-hidden="true" />}
                      <span className="text-muted-foreground block text-[10px] font-medium">{starter.category ?? "Starter"}</span>
                      <strong className="mt-1 block pr-3 text-sm">{starter.name}</strong>
                      <span className="text-muted-foreground mt-1 block text-xs leading-4">
                        {starter.description}
                      </span>
                    </button>
                  ))}
                </div>
                {starterResults.length === 0 && (
                  <p className="text-muted-foreground text-sm">No matching starter. Clear the search or describe your own app below.</p>
                )}
                <p className="text-muted-foreground text-xs">
                  These {APP_STARTERS.length} original briefs prefill an editable specification; the AI still needs to build and verify your app.
                </p>
              </section>
              <section aria-label="Clone vetted GitHub template source" className="space-y-3 rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Clone real open-source code from GitHub</h3>
                  <span className="rounded bg-muted px-2 py-1 text-[10px]">MIT-licensed · pinned version</span>
                </div>
                <p className="text-muted-foreground text-xs leading-5">
                  Unlike app ideas, these copy actual editable Next.js source files into a new project.
                  BuildRx preserves original GitHub attribution and licensing. You can edit the code, but must verify it before going live.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GITHUB_APP_TEMPLATES.map((template) => (
                    <div key={template.id} className="flex flex-col gap-2 rounded-lg border p-3">
                      <span className="text-muted-foreground text-[10px]">{template.category} · GitHub</span>
                      <strong className="text-sm">{template.name}</strong>
                      <p className="text-muted-foreground flex-1 text-xs leading-5">{template.description}</p>
                      <a href={template.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary underline underline-offset-4">View original source ↗</a>
                      <Button type="button" variant="outline" className="w-full" size="sm"
                        disabled={Boolean(importingGithub) || isPending || demoMode}
                        onClick={() => void importGithubTemplate(template.id)}>
                        {importingGithub === template.id ? <Loader2 className="size-4 animate-spin" /> : <LayoutTemplate className="size-4" />}
                        {importingGithub === template.id ? "Cloning source…" : "Clone to my project"}
                      </Button>
                    </div>
                  ))}
                </div>
                {demoMode && <p className="text-xs text-amber-700">Sign in and connect permanent storage to clone code.</p>}
                <p className="text-muted-foreground text-xs">Import does not install dependencies, activate databases, or deploy a live website. Binary images are excluded from the text-only editor.</p>
              </section>
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
                        {promptValue.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              form.setValue("prompt", "", {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              setSelectedStarter(null);
                            }}
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
                        onChange={(event) => {
                          field.onChange(event);
                          setSelectedStarter(null);
                        }}
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
                Create project & start building
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
