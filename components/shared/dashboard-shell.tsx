"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Globe,
  FileText,
  Search,
  Link2,
  TrendingUp,
  Users,
  CheckSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Zap,
  CreditCard,
  CircleHelp,
  PenLine,
  Target,
  Wand2,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/shared/use-auth";
import { Spinner } from "@/components/ui/spinner";
import { cn, getInitials } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/dashboard/keywords", label: "Keyword Research", icon: Search },
      { href: "/dashboard/keyword-difficulty", label: "Keyword Difficulty", icon: Target },
      { href: "/dashboard/serp-analysis", label: "SERP Analysis", icon: Search },
      { href: "/dashboard/competitors", label: "Competitors", icon: Users },
      { href: "/dashboard/domain", label: "Domain Overview", icon: Globe },
    ],
  },
  {
    label: "Audit & Track",
    items: [
      { href: "/dashboard/audit", label: "Site Audit", icon: Globe },
      { href: "/dashboard/positions", label: "Position Tracking", icon: TrendingUp },
      { href: "/dashboard/backlinks", label: "Backlink Analysis", icon: Link2 },
    ],
  },
  {
    label: "Create & Optimize",
    items: [
      { href: "/dashboard/content-writer", label: "AI Content Writer", icon: PenLine },
      { href: "/dashboard/content-optimizer", label: "Content Optimizer", icon: Wand2 },
      { href: "/dashboard/analyzer", label: "Content Analyzer", icon: FileText },
      { href: "/dashboard/onpage", label: "On-Page SEO", icon: CheckSquare },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut, isConfigured } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && isConfigured) {
      router.replace("/login");
    }
  }, [loading, user, isConfigured, router]);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Setup required</h2>
          <p className="mt-2 text-sm text-amber-800">
            This deployment is missing required environment variables. Add Supabase, OpenAI, and Stripe keys in your Vercel project settings to enable the dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const planLabel = profile?.plan ?? "free";
  const credits = profile?.credits ?? 0;

  return (
    <div className="flex min-h-screen bg-ink-50/40">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
        <SidebarContent pathname={pathname} credits={credits} planLabel={planLabel} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-ink-100 bg-white animate-fade-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-md p-2 text-ink-500 hover:bg-ink-100"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} credits={credits} planLabel={planLabel} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/90 px-4 glass sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 items-center md:flex">
            <p className="text-sm text-ink-500">
              Welcome back, <span className="font-medium text-ink-900">{profile?.full_name || user.email?.split("@")[0] || "there"}</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              <Zap className="h-3 w-3 text-amber-500" />
              {credits} credits
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/settings">
                <CreditCard className="h-4 w-4" />
                Upgrade
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-ink-100">
                  <Avatar>
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name ?? "User"} />
                    <AvatarFallback name={profile?.full_name || user.email} />
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-ink-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink-900">{profile?.full_name || "User"}</span>
                    <span className="text-xs text-ink-500">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://github.com/bankacem/seomaster-pro" target="_blank" rel="noopener noreferrer">
                    <CircleHelp className="h-4 w-4" />
                    Help & Docs
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-red-600 focus:bg-red-50 focus:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  credits,
  planLabel,
}: {
  pathname: string;
  credits: number;
  planLabel: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Credits widget */}
      <div className="border-t border-ink-100 p-3">
        <div className="rounded-lg border border-ink-100 bg-gradient-to-br from-ink-50 to-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-600">Plan</span>
            <Badge variant={planLabel === "free" ? "secondary" : "success"} className="text-[10px]">
              {planLabel}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-600">Credits</span>
            <span className="text-sm font-semibold text-ink-900">{credits}</span>
          </div>
          {planLabel === "free" && (
            <Button asChild size="sm" variant="gradient" className="mt-3 w-full text-xs">
              <Link href="/dashboard/settings">
                <Zap className="h-3 w-3" />
                Upgrade plan
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
