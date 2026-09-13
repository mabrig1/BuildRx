import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Badge } from "@/components/ui/badge";
import { brandConfig } from "@/lib/constants";

export function AppSidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Logo href="/dashboard" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>
      <div className="space-y-4 border-t p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold">{brandConfig.companyName}</p>
          <a
            href={brandConfig.contacts.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary block text-xs transition-colors"
          >
            Support: {brandConfig.contacts.whatsapp.value}
          </a>
          <a
            href={brandConfig.contacts.website.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary block truncate text-xs transition-colors"
          >
            {brandConfig.contacts.website.value}
          </a>
        </div>
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Plan</span>
          <Badge variant="secondary">Free</Badge>
        </div>
      </div>
    </aside>
  );
}
