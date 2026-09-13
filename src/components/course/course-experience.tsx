"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Code2, Rocket } from "lucide-react";

import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { courseModules } from "@/lib/course/buildrx-tech-plus";

const STORAGE_KEY = "buildrx-tech-plus-progress-v1";

export function CourseExperience() {
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) setCompleted(value.filter((item) => typeof item === "string"));
    } catch {
      // Ignore malformed local progress and start fresh.
    }
  }, []);

  const progress = useMemo(
    () => Math.round((completed.length / courseModules.length) * 100),
    [completed]
  );

  function toggle(moduleId: string) {
    setCompleted((current) => {
      const next = current.includes(moduleId)
        ? current.filter((id) => id !== moduleId)
        : [...current, moduleId];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Build-to-production progress</CardTitle>
              <CardDescription>
                Complete each module only after you can show its required artifact.
              </CardDescription>
            </div>
            <Badge variant="secondary">{progress}% complete</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Progress value={progress} />
          <p className="text-muted-foreground mt-3 text-sm">
            {completed.length} of {courseModules.length} production milestones verified.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        {courseModules.map((module) => {
          const done = completed.includes(module.id);
          return (
            <Card key={module.id} className={done ? "border-primary/40" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{module.week}</Badge>
                      {done ? <Badge>Evidence complete</Badge> : <Badge variant="secondary">Practical module</Badge>}
                    </div>
                    <CardTitle>{module.title}</CardTitle>
                    <CardDescription className="max-w-3xl">{module.outcome}</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant={done ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => toggle(module.id)}
                  >
                    {done ? <CheckCircle2 /> : <Circle />}
                    {done ? "Completed" : "Mark complete"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {module.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      <Rocket className="size-4" />
                      Required evidence
                    </div>
                    <p className="text-muted-foreground text-sm leading-6">{module.deliverable}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2 font-medium">
                      <Code2 className="size-4" />
                      BuildRx lab: {module.lab.name}
                    </div>
                    <p className="text-muted-foreground mb-4 text-sm leading-6">{module.lab.description}</p>
                    <CreateProjectDialog
                      defaultValues={{
                        name: module.lab.name,
                        description: "MABRIG Tech+ practical lab — " + module.title,
                        prompt: module.lab.prompt,
                      }}
                      trigger={
                        <Button>
                          <Code2 />
                          Launch lab in BuildRx
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
