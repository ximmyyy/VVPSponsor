"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Flag,
  Handshake,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Menu,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { workspaces, type Workspace } from "./navigation";
const icons = {
  overview: LayoutDashboard,
  sponsors: Users,
  packages: Package,
  contracts: Handshake,
  rights: ClipboardCheck,
  finance: Wallet,
  acquisition: Flag,
  tasks: ListTodo,
  events: CalendarDays,
  documents: FileText,
  reports: ChartNoAxesCombined,
  settings: Settings,
  contact: MessageCircle,
};

function Navigation({
  workspace,
  onNavigate,
}: {
  workspace: Workspace;
  onNavigate?: () => void;
}) {
  const config = workspaces[workspace];
  return (
    <nav aria-label="Hoofdnavigatie" className="workspace-nav">
      <p className="nav-caption">Werkruimte</p>
      <ul>
        {config.items.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons];
          return (
            <li key={item.label}>
              {item.href ? (
                <Link
                  className="nav-item nav-item-active"
                  href={item.href}
                  aria-current="page"
                  onClick={onNavigate}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  <span className="nav-active-dot" />
                </Link>
              ) : (
                <span
                  className="nav-item nav-item-unavailable"
                  aria-disabled="true"
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  <span className="nav-later">Later</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
function SidebarFooter() {
  return (
    <div className="sidebar-footer">
      <ShieldCheck className="size-5" aria-hidden="true" />
      <div>
        <strong>Lokale ontwerpweergave</strong>
        <p>Geen ingelogd account</p>
      </div>
    </div>
  );
}
export function WorkspaceShell({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const config = workspaces[workspace];
  return (
    <div className="workspace-shell">
      <a href="#inhoud" className="skip-link">
        Direct naar inhoud
      </a>
      <aside className="desktop-sidebar">
        <Link
          href="/"
          className="sidebar-brand"
          aria-label="Terug naar startpagina"
        >
          <Brand inverse />
        </Link>
        <Navigation workspace={workspace} />
        <SidebarFooter />
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="workspace-breadcrumb">
            <div className="mobile-menu">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Navigatie openen"
                  >
                    <Menu aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <div className="px-6 pb-2 pt-7 pr-16">
                    <SheetTitle className="text-lg font-semibold">
                      {config.name}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-sm text-sidebar-muted">
                      Navigatie van de lokale ontwerpweergave.
                    </SheetDescription>
                  </div>
                  <Navigation
                    workspace={workspace}
                    onNavigate={() => setOpen(false)}
                  />
                  <SidebarFooter />
                </SheetContent>
              </Sheet>
            </div>
            <span className="breadcrumb-parent">
              {config.eyebrow}
              <span aria-hidden="true">/</span>
            </span>
            <span>Overzicht</span>
          </div>
          <Badge>
            <LockKeyhole className="size-3.5" aria-hidden="true" /> Alleen
            lokaal
          </Badge>
        </header>
        <div className="design-notice">
          <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
          <p>Ontwerpweergave · Inloggen en toegangsrechten volgen in fase 3.</p>
        </div>
        <main id="inhoud" tabIndex={-1} className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            VV Pernis <span aria-hidden="true">·</span> {config.name}
          </span>
          <Link href="/ontwerp">
            Componenten <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <Link href="/">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Startpagina
          </Link>
        </footer>
      </div>
    </div>
  );
}
