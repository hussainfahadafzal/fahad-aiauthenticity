import { Link } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  FileText,
  FlaskConical,
  History,
  Info,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DISCLAIMER } from "@/lib/analysis/types";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analyze", label: "New Analysis", icon: FlaskConical },
  { to: "/history", label: "History", icon: History },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/methodology", label: "Methodology", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about", label: "About", icon: Info },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          activeProps={{
            className:
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-sidebar-accent text-foreground font-medium border-l-2 border-primary",
          }}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <span className="font-display text-base font-semibold">AuthenticityAI</span>
        </Link>
        <NavLinks />
        <div className="mt-auto rounded-md border border-sidebar-border bg-surface p-3 text-[11px] leading-relaxed text-muted-foreground">
          {DISCLAIMER}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden no-print">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-4">
            <SheetTitle className="mb-6 flex items-center gap-2 font-display">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              AuthenticityAI
            </SheetTitle>
            <NavLinks onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link to="/" className="flex items-center gap-2">
          <Activity className="size-5 text-evidence" aria-hidden />
          <span className="font-display text-sm font-semibold">AuthenticityAI</span>
        </Link>
      </header>

      <main id="main" className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
