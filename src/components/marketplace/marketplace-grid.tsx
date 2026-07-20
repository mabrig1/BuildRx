"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { TemplateCard, type MarketplaceTemplate } from "@/components/marketplace/template-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TemplateRow extends MarketplaceTemplate {
  created_at: string;
}

export function MarketplaceGrid({
  templates,
  currentUserId,
}: {
  templates: TemplateRow[];
  currentUserId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"newest" | "trending">("newest");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(templates.map((t) => t.category)))],
    [templates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = templates.filter(
      (t) =>
        (category === "all" || t.category === category) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q))
    );
    result = [...result].sort((a, b) =>
      sort === "trending"
        ? b.install_count - a.install_count
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return result;
  }, [templates, query, category, sort]);

  if (templates.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
        No templates published yet — be the first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "trending")}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="trending">Trending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
          No templates match your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard key={template.id} template={template} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
