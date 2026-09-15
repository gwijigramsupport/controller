import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  Copy,
  ExternalLink,
  Gauge,
  Inbox,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ServerCog,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unplug,
  UserRound,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetSessionQueryKey,
  getListActivityQueryKey,
  getListSessionsQueryKey,
  useConnectSession,
  useCreateSession,
  useDeleteSession,
  useDisconnectSession,
  useGetDashboard,
  useGetSession,
  useListActivity,
  useListSessions,
  useLogoutSession,
  useRequestPairingCode,
} from '@workspace/api-client-react';
import type { ActivityEvent, WhatsAppSession } from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#203c36',
    colorForeground: '#192735',
    colorMutedForeground: '#71807a',
    colorDanger: '#b34f42',
    colorBackground: '#fbfcf8',
    colorInput: '#f7faf5',
    colorInputForeground: '#192735',
    colorNeutral: '#d6e0d6',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfcf8] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#192735] font-extrabold',
    headerSubtitle: 'text-[#71807a]',
    socialButtonsBlockButtonText: 'text-[#304740] font-semibold',
    formFieldLabel: 'text-[#304740] font-semibold',
    footerActionLink: 'text-[#203c36] font-bold',
    footerActionText: 'text-[#71807a]',
    dividerText: 'text-[#71807a]',
    formButtonPrimary: 'bg-[#203c36] hover:bg-[#294c43] text-white',
    formFieldInput: 'bg-[#f7faf5] border-[#d6e0d6] text-[#192735]',
    socialButtonsBlockButton: 'border-[#d6e0d6] bg-[#f7faf5]',
    dividerLine: 'bg-[#d6e0d6]',
    alert: 'border-[#efc8bf] bg-[#fff5f2]',
    alertText: 'text-[#8b4137]',
    main: 'bg-transparent',
  },
};

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: Gauge },
  { href: '/sessions', label: 'Sessions', icon: Network },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const statusMeta: Record<string, { label: string; tone: string; dot: string }> = {
  connected: { label: 'Connected', tone: 'status-connected', dot: 'bg-[#8fcb46]' },
  connecting: { label: 'Connecting', tone: 'status-connecting', dot: 'bg-[#e6a943]' },
  disconnected: { label: 'Disconnected', tone: 'status-disconnected', dot: 'bg-[#8a94a6]' },
  logged_out: { label: 'Logged out', tone: 'status-logged-out', dot: 'bg-[#bd7f70]' },
  error: { label: 'Needs attention', tone: 'status-error', dot: 'bg-[#d95c50]' },
};

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function formatRelative(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime())) return 'Unknown';
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? statusMeta.disconnected;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.02em] ${meta.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
      {meta.label}
    </span>
  );
}

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${inverse ? 'text-white' : 'text-foreground'}`}>
      <div className={`grid h-9 w-9 place-items-center rounded-[11px] ${inverse ? 'bg-[#d5ee70] text-[#192735]' : 'bg-primary text-primary-foreground'}`}>
        <Link2 className="h-[18px] w-[18px]" strokeWidth={2.6} />
      </div>
      <div className="leading-none">
        <div className="font-extrabold tracking-[-0.04em]">relayroom</div>
        <div className={`mt-1 font-mono text-[9px] uppercase tracking-[0.18em] ${inverse ? 'text-white/45' : 'text-muted-foreground'}`}>operator console</div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry, compact = false }: { onRetry?: () => void; compact?: boolean }) {
  return (
    <div data-testid="state-error" className={`rounded-2xl border border-[#efc2bc] bg-[#fff8f6] ${compact ? 'p-5' : 'p-8'} text-center`}>
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#f8ded9] text-[#b7493d]"><AlertTriangle className="h-5 w-5" /></div>
      <h3 className="mt-4 font-bold text-[#63352e]">The room is quiet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#93645d]">We could not reach the session service. Your connections are safe; try again in a moment.</p>
      {onRetry && <button data-testid="button-retry" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#63352e] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#4d2924]"><RefreshCcw className="h-3.5 w-3.5" /> Try again</button>}
    </div>
  );
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return (
    <div data-testid="state-loading" className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-32 rounded bg-muted" /><div className="h-2.5 w-48 rounded bg-muted" /></div><div className="h-7 w-20 rounded-full bg-muted" /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title, detail, action }: { icon?: typeof Inbox; title: string; detail: string; action?: ReactNode }) {
  return (
    <div data-testid="state-empty" className="rounded-2xl border border-dashed border-border bg-card/75 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
      <h3 className="mt-4 font-bold tracking-[-0.02em]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function ActivityItem({ event, compact = false }: { event: ActivityEvent; compact?: boolean }) {
  const isError = event.type === 'session_error';
  const isMessage = event.type === 'message_received';
  return (
    <div data-testid={`activity-event-${event.id}`} className={`group relative flex gap-3 ${compact ? 'py-2.5' : 'py-4'}`}>
      <div className={`relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${isError ? 'bg-[#f9e3df] text-[#bd5045]' : isMessage ? 'bg-[#e9f0db] text-primary' : 'bg-secondary text-primary'}`}>
        {isError ? <AlertTriangle className="h-3.5 w-3.5" /> : isMessage ? <MessageSquare className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="truncate text-sm font-bold">{event.title}</div>
          <div className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatRelative(event.createdAt)}</div>
        </div>
        {event.detail && <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{event.detail}</div>}
        {event.sessionName && <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-primary"><CircleDot className="h-2.5 w-2.5" /> {event.sessionName}</div>}
      </div>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useClerk();
  const isActive = (href: string) => location === href || (href !== '/dashboard' && location.startsWith(href));
  const logout = () => {
    void signOut({ redirectUrl: basePath || '/' });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ${collapsed ? 'lg:w-[80px]' : ''} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex h-[82px] items-center border-b border-sidebar-border px-5 ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
          <Wordmark inverse />
          {!collapsed && <button data-testid="button-collapse-sidebar" onClick={() => setCollapsed(true)} className="hidden rounded-md p-1.5 text-white/45 hover:bg-white/10 hover:text-white lg:block"><PanelLeftClose className="h-4 w-4" /></button>}
        </div>
        {collapsed && <button data-testid="button-expand-sidebar" onClick={() => setCollapsed(false)} className="mx-auto mt-4 hidden rounded-md p-1.5 text-white/45 hover:bg-white/10 hover:text-white lg:block"><PanelLeftOpen className="h-4 w-4" /></button>}
        <div className={`px-3 pt-7 ${collapsed ? 'lg:px-2' : ''}`}>
          {!collapsed && <div className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Workspace</div>}
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive(href) ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_#d5ee70]' : 'text-white/58 hover:bg-white/7 hover:text-white'} ${collapsed ? 'justify-center px-0' : ''}`}>
                <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive(href) ? 'text-sidebar-primary' : ''}`} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && label === 'Sessions' && <span className="ml-auto rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-white/45">live</span>}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-3">
          {!collapsed && <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-white/70"><ShieldCheck className="h-3.5 w-3.5 text-sidebar-primary" /> All systems monitored</div>
            <div className="mt-2 font-mono text-[10px] text-white/35">Tenant / relayroom-demo</div>
          </div>}
          <button data-testid="button-sign-out" onClick={logout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/50 transition hover:bg-white/8 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}><LogOut className="h-4 w-4" />{!collapsed && 'Sign out'}</button>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-mobile-nav" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[#172431]/40 lg:hidden" />}
      <main className={`min-h-[100dvh] transition-[padding] duration-200 ${collapsed ? 'lg:pl-[80px]' : 'lg:pl-[258px]'}`}>
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-border/80 bg-background/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button data-testid="button-open-mobile-nav" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#8fcb46]" /> Relayroom / {location === '/dashboard' ? 'overview' : location.replace('/', '')}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#8fcb46]" /> Service healthy</div>
            <button data-testid="button-header-account" onClick={() => setLocation('/settings')} className="grid h-8 w-8 place-items-center rounded-full bg-[#d9e8b4] text-xs font-extrabold text-primary">RR</button>
          </div>
        </header>
        <div className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</div><h1 className="text-[28px] font-extrabold tracking-[-0.055em] text-foreground sm:text-[34px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p></div>{action}</div>;
}

function DashboardPage() {
  const dashboard = useGetDashboard();
  const data = dashboard.data;
  const sessions = data?.sessions ?? [];
  const activity = data?.recentActivity ?? [];
  const attention = sessions.filter((session) => session.status === 'error' || session.status === 'logged_out' || session.status === 'disconnected');

  if (dashboard.isLoading) return <><PageIntro eyebrow="Live workspace" title="Good morning, operator." detail="Loading the current state of your WhatsApp fleet." /><LoadingRows count={3} /></>;
  if (dashboard.isError) return <><PageIntro eyebrow="Live workspace" title="Good morning, operator." detail="Your workspace is ready when the service reconnects." /><ErrorState onRetry={() => dashboard.refetch()} /></>;

  return (
    <div className="animate-page-in">
      <PageIntro eyebrow="Live workspace" title="Good morning, operator." detail="A quiet control room is a healthy one. Here is the state of every linked account." action={<Link href="/sessions" data-testid="link-manage-sessions" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_8px_18px_-10px_hsl(var(--primary))] transition hover:-translate-y-0.5"><SlidersHorizontal className="h-4 w-4" /> Manage sessions</Link>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Connected now" value={`${data?.connectedSessions ?? 0}/${data?.totalSessions ?? 0}`} detail={data?.totalSessions ? `${Math.round(((data.connectedSessions ?? 0) / data.totalSessions) * 100)}% of fleet` : 'No sessions yet'} icon={Wifi} accent="lime" />
        <MetricCard label="Messages today" value={formatNumber(data?.messagesToday)} detail="Across all linked accounts" icon={MessageSquare} accent="teal" />
        <MetricCard label="Attention needed" value={formatNumber(data?.attentionSessions)} detail={data?.attentionSessions ? 'Review before the next shift' : 'Nothing waiting on you'} icon={AlertTriangle} accent={data?.attentionSessions ? 'coral' : 'slate'} />
        <MetricCard label="7-day uptime" value={`${(data?.uptimePercent ?? 0).toFixed(1)}%`} detail="Measured across active sessions" icon={Activity} accent="blue" />
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-extrabold tracking-[-0.025em]">Session pulse</h2><p className="mt-1 text-xs text-muted-foreground">The accounts carrying your operation right now.</p></div><Link href="/sessions" data-testid="link-view-all-sessions" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {sessions.length === 0 ? <div className="p-5"><EmptyState icon={Network} title="Your fleet starts here" detail="Create a session and pair the first WhatsApp account to begin monitoring." action={<Link href="/sessions" data-testid="link-create-first-session" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Add session</Link>} /></div> : <div className="divide-y divide-border/80">{sessions.slice(0, 5).map((session) => <SessionRow key={session.id} session={session} compact />)}</div>}
        </section>
        <section className="panel">
          <div className="border-b border-border px-5 py-4"><div className="flex items-center justify-between"><div><h2 className="font-extrabold tracking-[-0.025em]">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">A short history of operational changes.</p></div><Link href="/activity" data-testid="link-view-activity" className="text-xs font-bold text-primary hover:underline">Full log</Link></div></div>
          <div className="px-5">{activity.length ? activity.slice(0, 6).map((event) => <ActivityItem key={event.id} event={event} compact />) : <div className="py-9"><EmptyState icon={Clock3} title="No activity yet" detail="Connection events will appear here as your fleet changes." /></div>}</div>
        </section>
      </div>
      {attention.length > 0 && <section className="mt-5 rounded-2xl border border-[#edc7bf] bg-[#fff9f6] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f5ddd8] text-[#b95246]"><AlertTriangle className="h-4 w-4" /></div><div><h2 className="font-bold text-[#63352e]">{attention.length} {attention.length === 1 ? 'session needs' : 'sessions need'} a look</h2><p className="mt-1 text-xs leading-5 text-[#93645d]">Disconnected and logged-out sessions may need a fresh pairing before messages resume.</p></div></div><Link href="/sessions?filter=attention" data-testid="link-review-attention" className="inline-flex items-center gap-2 self-start rounded-lg border border-[#e5b5ac] px-3 py-2 text-xs font-bold text-[#8e443b] hover:bg-[#fcece8] sm:self-auto">Review attention <ArrowRight className="h-3.5 w-3.5" /></Link></div></section>}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, accent }: { label: string; value: string; detail: string; icon: typeof Wifi; accent: string }) {
  const accentClass = { lime: 'bg-[#edf5d8] text-[#61862d]', teal: 'bg-[#deeee8] text-primary', coral: 'bg-[#fae3df] text-[#b65348]', slate: 'bg-secondary text-muted-foreground', blue: 'bg-[#e2ebf4] text-[#47708b]' }[accent] ?? 'bg-secondary text-primary';
  return <div className="panel p-4"><div className="flex items-start justify-between"><div className={`grid h-9 w-9 place-items-center rounded-xl ${accentClass}`}><Icon className="h-4 w-4" /></div><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">live</span></div><div className="mt-5 text-[25px] font-extrabold tracking-[-0.05em]">{value}</div><div className="mt-1 text-xs font-bold">{label}</div><div className="mt-2 text-[11px] text-muted-foreground">{detail}</div></div>;
}

function SessionRow({ session, compact = false, onAction }: { session: WhatsAppSession; compact?: boolean; onAction?: (action: 'connect' | 'disconnect' | 'logout' | 'delete', session: WhatsAppSession) => void }) {
  return <div data-testid={`row-session-${session.id}`} className={`group flex items-center gap-3 ${compact ? 'px-5 py-3.5' : 'rounded-xl border border-border bg-card p-4 shadow-[0_3px_12px_-10px_rgba(20,35,48,0.35)]'}`}>
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary font-mono text-xs font-medium text-primary">{session.name.slice(0, 2).toUpperCase()}</div>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Link href={`/sessions/${session.id}`} data-testid={`link-session-${session.id}`} className="truncate text-sm font-bold hover:text-primary hover:underline">{session.name}</Link>{session.profileName && <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {session.profileName}</span>}</div><div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground"><Phone className="h-2.5 w-2.5" /> {session.displayNumber || session.phoneNumber || 'Number not paired'} <span className="text-border">/</span> seen {formatRelative(session.lastSeenAt)}</div></div>
    <div className="hidden shrink-0 sm:block"><StatusBadge status={session.status} /></div>
    <div className="hidden w-20 shrink-0 text-right lg:block"><div className="font-mono text-xs font-medium">{formatNumber(session.messageCount)}</div><div className="mt-0.5 text-[10px] text-muted-foreground">messages</div></div>
    {onAction && <div className="relative"><button data-testid={`button-session-menu-${session.id}`} onClick={() => onAction(session.status === 'connected' ? 'disconnect' : 'connect', session)} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${session.status === 'connected' ? 'text-muted-foreground hover:bg-secondary' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>{session.status === 'connected' ? 'Pause' : 'Connect'}</button></div>}
    {!onAction && <Link href={`/sessions/${session.id}`} data-testid={`link-open-session-${session.id}`} className="rounded-lg p-2 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"><ArrowRight className="h-4 w-4" /></Link>}
  </div>;
}

function SessionsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const query = useListSessions({ search: search || undefined, status: status === 'all' ? undefined : status as never });
  const create = useCreateSession();
  const remove = useDeleteSession();
  const connect = useConnectSession();
  const disconnect = useDisconnectSession();
  const logout = useLogoutSession();
  const queryClient = useQueryClient();
  const sessions = query.data ?? [];
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() }); };
  const perform = (action: 'connect' | 'disconnect' | 'logout' | 'delete', session: WhatsAppSession) => {
    setMenuId(null);
    if (action === 'delete' && !window.confirm(`Delete ${session.name}? This cannot be undone.`)) return;
    const options = { onSuccess: () => invalidate() };
    if (action === 'connect') connect.mutate({ sessionId: session.id }, options);
    if (action === 'disconnect') disconnect.mutate({ sessionId: session.id }, options);
    if (action === 'logout') logout.mutate({ sessionId: session.id }, options);
    if (action === 'delete') remove.mutate({ sessionId: session.id }, options);
  };
  useEffect(() => { if (params.get('filter') === 'attention') setStatus('disconnected'); }, []);

  return <div className="animate-page-in"><PageIntro eyebrow="Connection fleet" title="Sessions" detail="Every linked WhatsApp account, one calm operational view." action={<button data-testid="button-create-session" onClick={() => setCreateOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_8px_18px_-10px_hsl(var(--primary))] transition hover:-translate-y-0.5"><Plus className="h-4 w-4" /> New session</button>} />
    <div className="panel mb-5 p-3"><div className="flex flex-col gap-3 md:flex-row"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-sessions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by session, profile, or number" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><div className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">{['all', 'connected', 'connecting', 'disconnected', 'error'].map((item) => <button key={item} data-testid={`button-filter-${item}`} onClick={() => setStatus(item)} className={`whitespace-nowrap rounded-md px-3 py-2 text-[11px] font-bold capitalize transition ${status === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item === 'all' ? 'All sessions' : item === 'error' ? 'Attention' : item}</button>)}</div></div></div>
    {query.isLoading ? <LoadingRows /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : sessions.length === 0 ? <EmptyState icon={search ? Search : Network} title={search ? 'No matching sessions' : 'No WhatsApp sessions yet'} detail={search ? 'Try a different name, number, or clear the search.' : 'Create an isolated session to start a safe pairing flow.'} action={search ? <button data-testid="button-clear-search" onClick={() => setSearch('')} className="rounded-lg border border-border px-3 py-2 text-sm font-bold hover:bg-secondary">Clear search</button> : <button data-testid="button-create-empty-session" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Add your first session</button>} /> : <div className="space-y-2">{sessions.map((session) => <div key={session.id} className="relative"><SessionRow session={session} onAction={perform} /><div className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-12"><button data-testid={`button-more-session-${session.id}`} onClick={() => setMenuId(menuId === session.id ? null : session.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>{menuId === session.id && <div className="absolute right-0 top-10 z-10 w-40 rounded-xl border border-border bg-popover p-1.5 shadow-xl"><Link href={`/sessions/${session.id}`} data-testid={`menu-details-${session.id}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-secondary"><ExternalLink className="h-3.5 w-3.5" /> Open details</Link>{session.status !== 'connected' && <button data-testid={`menu-connect-${session.id}`} onClick={() => perform('connect', session)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-secondary"><Wifi className="h-3.5 w-3.5" /> Connect</button>}{session.status === 'connected' && <button data-testid={`menu-disconnect-${session.id}`} onClick={() => perform('disconnect', session)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-secondary"><WifiOff className="h-3.5 w-3.5" /> Disconnect</button>}<button data-testid={`menu-logout-${session.id}`} onClick={() => perform('logout', session)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold hover:bg-secondary"><LogOut className="h-3.5 w-3.5" /> Log out device</button><button data-testid={`menu-delete-${session.id}`} onClick={() => perform('delete', session)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-destructive hover:bg-[#fff1ef]"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div>}</div></div>)}</div>}
    {createOpen && <CreateSessionDialog onClose={() => setCreateOpen(false)} pending={create.isPending} error={create.error ? 'Could not create this session.' : undefined} onCreate={(name, phoneNumber) => create.mutate({ data: { name, phoneNumber: phoneNumber || undefined } }, { onSuccess: (session) => { invalidate(); setCreateOpen(false); setLocation(`/sessions/${session.id}`); } })} />}
  </div>;
}

function CreateSessionDialog({ onClose, onCreate, pending, error }: { onClose: () => void; onCreate: (name: string, phone: string) => void; pending: boolean; error?: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim()) onCreate(name.trim(), phone.trim()); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#172431]/45 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4efd0] text-primary"><Plus className="h-5 w-5" /></div><h2 className="mt-4 text-xl font-extrabold tracking-[-0.04em]">Add a session</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Create a secure home for one WhatsApp account.</p></div><button data-testid="button-close-create-session" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button></div><form onSubmit={submit} className="mt-6 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold">Session name</span><input data-testid="input-session-name" autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Support / West Coast" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="block"><span className="mb-1.5 flex items-center justify-between text-xs font-bold">Phone number <span className="font-normal text-muted-foreground">optional for now</span></span><input data-testid="input-session-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 415 555 0138" className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>{error && <p data-testid="text-create-error" className="rounded-lg bg-[#fff1ef] px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}<div className="flex gap-2 pt-2"><button type="button" data-testid="button-cancel-create" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-bold hover:bg-secondary">Cancel</button><button type="submit" data-testid="button-submit-create" disabled={pending || !name.trim()} className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Creating…' : 'Create session'}</button></div></form></div></div>;
}

function SessionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const query = useGetSession(id, { query: { enabled: Boolean(id), queryKey: getGetSessionQueryKey(id) } });
  const activity = useListActivity({ limit: 20 });
  const pairing = useRequestPairingCode();
  const connect = useConnectSession();
  const disconnect = useDisconnectSession();
  const logout = useLogoutSession();
  const remove = useDeleteSession();
  const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pairPhone, setPairPhone] = useState('');
  const [pairOpen, setPairOpen] = useState(false);
  const session = query.data;
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() }); };
  const lifecycle = (kind: 'connect' | 'disconnect' | 'logout') => { const options = { onSuccess: () => invalidate() }; if (kind === 'connect') connect.mutate({ sessionId: id }, options); if (kind === 'disconnect') disconnect.mutate({ sessionId: id }, options); if (kind === 'logout') logout.mutate({ sessionId: id }, options); };
  const requestCode = (event: FormEvent) => { event.preventDefault(); if (!pairPhone.trim()) return; pairing.mutate({ sessionId: id, data: { phoneNumber: pairPhone.trim() } }, { onSuccess: (response) => { setPairingCode({ code: response.code, expiresAt: response.expiresAt }); setPairOpen(false); invalidate(); } }); };
  const copyCode = () => { if (pairingCode) navigator.clipboard?.writeText(pairingCode.code); };

  if (query.isLoading) return <><Link href="/sessions" data-testid="link-back-loading" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Sessions</Link><LoadingRows count={2} /></>;
  if (query.isError || !session) return <><Link href="/sessions" data-testid="link-back-error" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Sessions</Link><ErrorState onRetry={() => query.refetch()} /></>;

  const sessionEvents = (activity.data ?? []).filter((event) => event.sessionId === id);
  return <div className="animate-page-in"><Link href="/sessions" data-testid="link-back-sessions" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> All sessions</Link><div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Session detail</div><div className="flex flex-wrap items-center gap-3"><h1 data-testid="text-session-name" className="text-[30px] font-extrabold tracking-[-0.055em]">{session.name}</h1><StatusBadge status={session.status} /></div><p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {session.displayNumber || session.phoneNumber || 'Phone number not paired'}</p></div><div className="flex flex-wrap gap-2">{session.status === 'connected' ? <button data-testid="button-disconnect-session" onClick={() => lifecycle('disconnect')} disabled={disconnect.isPending} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary disabled:opacity-50"><Unplug className="h-4 w-4" /> {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}</button> : <button data-testid="button-connect-session" onClick={() => lifecycle('connect')} disabled={connect.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Wifi className="h-4 w-4" /> {connect.isPending ? 'Connecting…' : 'Connect'}</button>}<button data-testid="button-logout-session" onClick={() => { if (window.confirm('Log this device out of WhatsApp?')) lifecycle('logout'); }} disabled={logout.isPending} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary"><LogOut className="h-4 w-4" /> Log out</button></div></div>
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><section className="space-y-5"><div className="panel p-5"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-bold text-primary"><ShieldCheck className="h-4 w-4" /> Connection posture</div><h2 className="mt-3 text-2xl font-extrabold tracking-[-0.05em]">{statusMeta[session.status]?.label ?? 'Unknown state'}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{session.status === 'connected' ? 'The account is linked and its worker is available. Messages can flow normally.' : session.status === 'error' ? session.errorMessage || 'The session reported an error. Review the pairing state and try again.' : 'The account is not currently exchanging messages. Start a safe pairing or connect the worker when ready.'}</p></div><div className={`grid h-14 w-14 place-items-center rounded-2xl ${session.status === 'connected' ? 'bg-[#e5f0d4] text-[#668d31]' : 'bg-secondary text-muted-foreground'}`}>{session.status === 'connected' ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}</div></div><div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4"><DetailStat label="Messages" value={formatNumber(session.messageCount)} /><DetailStat label="Last seen" value={formatRelative(session.lastSeenAt)} /><DetailStat label="Created" value={formatDate(session.createdAt).split(',')[0]} /><DetailStat label="Updated" value={formatRelative(session.updatedAt)} /></div></div><div className="panel p-5"><div className="flex items-center justify-between"><div><h2 className="font-extrabold">Pair this account</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Generate a short-lived code to link WhatsApp without exposing credentials.</p></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e4efd0] text-primary"><Link2 className="h-4 w-4" /></div></div>{pairingCode ? <div className="mt-5 rounded-xl border border-[#c8da9d] bg-[#f5f9ea] p-4"><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#63832d]">Pairing code</div><div data-testid="text-pairing-code" className="mt-2 font-mono text-3xl font-medium tracking-[0.2em] text-[#405c1d]">{pairingCode.code}</div><div className="mt-2 flex items-center gap-1.5 text-xs text-[#6e8052]"><Clock3 className="h-3.5 w-3.5" /> Expires {formatDate(pairingCode.expiresAt)}</div></div><button data-testid="button-copy-pairing-code" onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c8da9d] bg-card px-2.5 py-2 text-xs font-bold text-[#557624] hover:bg-[#eef5dd]"><Copy className="h-3.5 w-3.5" /> Copy</button></div></div> : <button data-testid="button-start-pairing" onClick={() => { setPairPhone(session.phoneNumber || ''); setPairOpen(true); }} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"><Zap className="h-4 w-4" /> Start pairing flow</button>}</div></section><section className="panel overflow-hidden"><div className="border-b border-border px-5 py-4"><h2 className="font-extrabold">Session activity</h2><p className="mt-1 text-xs text-muted-foreground">Events scoped to this account.</p></div>{sessionEvents.length ? <div className="px-5">{sessionEvents.map((event) => <ActivityItem key={event.id} event={event} />)}</div> : <div className="p-5"><EmptyState icon={Clock3} title="No session events" detail="Connection and message events will appear here." /></div>}</section></div>
    <div className="mt-5 flex justify-end"><button data-testid="button-delete-session" onClick={() => { if (window.confirm(`Delete ${session.name}? This cannot be undone.`)) remove.mutate({ sessionId: id }, { onSuccess: () => { invalidate(); setLocation('/sessions'); } }); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-destructive hover:bg-[#fff1ef]"><Trash2 className="h-3.5 w-3.5" /> Delete session</button></div>
    {pairOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#172431]/45 p-4 backdrop-blur-sm"><div role="dialog" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4efd0] text-primary"><Link2 className="h-5 w-5" /></div><h2 className="mt-4 text-xl font-extrabold tracking-[-0.04em]">Request pairing code</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Use the number attached to the WhatsApp account you want to link.</p></div><button data-testid="button-close-pairing" onClick={() => setPairOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button></div><form onSubmit={requestCode} className="mt-6"><label className="block"><span className="mb-1.5 block text-xs font-bold">International phone number</span><input data-testid="input-pairing-phone" autoFocus required value={pairPhone} onChange={(event) => setPairPhone(event.target.value)} placeholder="+1 415 555 0138" className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>{pairing.isError && <p data-testid="text-pairing-error" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-xs font-semibold text-destructive">Could not request a code. Check the number and try again.</p>}<div className="mt-5 flex gap-2"><button type="button" data-testid="button-cancel-pairing" onClick={() => setPairOpen(false)} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-bold hover:bg-secondary">Cancel</button><button type="submit" data-testid="button-submit-pairing" disabled={pairing.isPending} className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{pairing.isPending ? 'Requesting…' : 'Request code'}</button></div></form></div></div>}</div>;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return <div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-bold">{value}</div></div>;
}

function ActivityPage() {
  const activity = useListActivity({ limit: 100 });
  return <div className="animate-page-in"><PageIntro eyebrow="Operational history" title="Activity" detail="A reliable, human-readable trail of what changed across your workspace." action={<button data-testid="button-refresh-activity" onClick={() => activity.refetch()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-secondary"><RefreshCcw className="h-4 w-4" /> Refresh log</button>} />{activity.isLoading ? <LoadingRows count={5} /> : activity.isError ? <ErrorState onRetry={() => activity.refetch()} /> : activity.data?.length ? <section className="panel max-w-4xl px-5 sm:px-8"><div className="border-b border-border py-4"><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{activity.data.length} recent events</div></div><div className="divide-y divide-border/80">{activity.data.map((event) => <ActivityItem key={event.id} event={event} />)}</div></section> : <EmptyState icon={Activity} title="No activity recorded" detail="The timeline will populate as sessions are created, paired, and used." />}</div>;
}

function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return <div className="animate-page-in"><PageIntro eyebrow="Workspace preferences" title="Settings" detail="A home for workspace-level controls as your operation grows." /><div className="grid max-w-4xl gap-5 lg:grid-cols-[1.2fr_0.8fr]"><section className="panel p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-border pb-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><UserRound className="h-4 w-4" /></div><div><h2 className="font-extrabold">Workspace profile</h2><p className="mt-1 text-xs text-muted-foreground">How operators identify this console.</p></div></div><div className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold">Workspace name</span><input data-testid="input-workspace-name" defaultValue="Relayroom demo" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Operator email</span><input data-testid="input-operator-email" defaultValue="operator@relayroom.local" type="email" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><div className="flex items-center justify-between pt-2"><span data-testid="text-settings-saved" className={`text-xs font-bold text-primary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}><Check className="mr-1 inline h-3.5 w-3.5" /> Saved</span><button data-testid="button-save-settings" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">Save changes</button></div></div></section><section className="panel p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-border pb-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4efd0] text-primary"><ShieldCheck className="h-4 w-4" /></div><div><h2 className="font-extrabold">Safety defaults</h2><p className="mt-1 text-xs text-muted-foreground">Conservative by design.</p></div></div><div className="mt-5 space-y-4"><SettingToggle label="Confirm destructive actions" detail="Ask before logging out or deleting a session." checked /><SettingToggle label="Pairing expiry reminders" detail="Show a reminder when a code is close to expiring." checked /><SettingToggle label="Message activity" detail="Include message events in the timeline." checked /></div></section></div></div>;
}

function SettingToggle({ label, detail, checked }: { label: string; detail: string; checked: boolean }) {
  const [on, setOn] = useState(checked);
  return <button data-testid={`button-toggle-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setOn(!on)} className="flex w-full items-start justify-between gap-4 text-left"><div><div className="text-sm font-bold">{label}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div></div><span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} /></span></button>;
}

function LandingPage() {
  return <div className="min-h-[100dvh] overflow-hidden bg-[#f2f5f1]"><header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8"><Wordmark /><div className="flex items-center gap-3"><Link href="/sign-in" data-testid="link-landing-sign-in" className="hidden px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground sm:block">Sign in</Link><Link href="/sign-up" data-testid="link-landing-sign-up" className="rounded-lg bg-primary px-3.5 py-2.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5">Create workspace</Link></div></header><main><section className="relative mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:pb-28 lg:pt-28"><div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]"><div className="relative z-10"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#cddbbd] bg-[#f7faef] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#5c792f]"><span className="h-1.5 w-1.5 rounded-full bg-[#8fcb46]" /> connection health, made clear</div><h1 className="max-w-2xl text-[46px] font-extrabold leading-[0.99] tracking-[-0.075em] text-[#192735] sm:text-[66px]">Keep every account <span className="text-primary">within reach.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-[#61706d] sm:text-lg">Relayroom gives multi-account WhatsApp operators one dependable place to pair, monitor, and move their connections safely.</p><div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/sign-up" data-testid="link-hero-get-started" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_12px_25px_-12px_hsl(var(--primary))] transition hover:-translate-y-0.5">Start operating <ArrowRight className="h-4 w-4" /></Link><Link href="/sign-in" data-testid="link-hero-sign-in" className="inline-flex items-center gap-2 rounded-xl border border-[#cbd7d1] bg-[#f8fbf7] px-5 py-3.5 text-sm font-bold text-[#304740] hover:bg-white">Sign in to console</Link></div><div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#788580]"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Isolated sessions</span><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Safe lifecycle controls</span></div></div><div className="relative"><div className="absolute -inset-6 rounded-[40px] bg-[#dfe9cf]/60 blur-2xl" /><div className="relative rounded-[26px] border border-[#d3ded3] bg-[#fbfcf8] p-3 shadow-[0_35px_75px_-35px_rgba(35,60,50,0.45)]"><div className="rounded-[18px] border border-[#dce5dc] bg-[#f3f6f1] p-4 sm:p-5"><div className="flex items-center justify-between border-b border-[#dce5dc] pb-4"><div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[#203c36] text-[#d5ee70]"><Link2 className="h-3.5 w-3.5" /></div><div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#63716d]">fleet pulse</div></div><div className="flex items-center gap-1.5 font-mono text-[9px] text-[#78907e]"><span className="h-1.5 w-1.5 rounded-full bg-[#8fcb46]" /> live</div></div><div className="grid grid-cols-3 gap-2 py-5"><div className="rounded-xl bg-[#e2efca] p-3"><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6b853e]">connected</div><div className="mt-2 text-2xl font-extrabold tracking-[-0.06em] text-[#304a26]">12</div></div><div className="rounded-xl bg-[#e6eeed] p-3"><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#667a75]">messages</div><div className="mt-2 text-2xl font-extrabold tracking-[-0.06em] text-[#304740]">1,284</div></div><div className="rounded-xl bg-[#f6e5df] p-3"><div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#a2665c]">attention</div><div className="mt-2 text-2xl font-extrabold tracking-[-0.06em] text-[#6e382f]">02</div></div></div><div className="rounded-xl border border-[#dce5dc] bg-[#fbfcf8] p-3"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-bold text-[#40514b]">Session pulse</span><span className="font-mono text-[9px] text-[#81918a]">last 24h</span></div>{['North America / Support', 'Europe / Dispatch', 'APAC / Concierge'].map((name, i) => <div key={name} className="flex items-center gap-2.5 border-t border-[#edf0ec] py-2.5"><div className={`h-1.5 w-1.5 rounded-full ${i === 2 ? 'bg-[#e6a943]' : 'bg-[#8fcb46]'}`} /><span className="flex-1 text-[10px] font-semibold text-[#596963]">{name}</span><span className="font-mono text-[9px] text-[#87958f]">{i === 2 ? 'pairing' : 'healthy'}</span></div>)}</div></div></div><div className="absolute -bottom-6 -left-4 rounded-xl border border-[#d3ded3] bg-[#fbfcf8] px-3 py-2 shadow-lg sm:-left-8"><div className="flex items-center gap-2 text-[10px] font-bold text-[#435b50]"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Calm by default</div></div></div></div></section><section className="border-t border-[#dce5dc] bg-[#e8eee5]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-3"><LandingFeature icon={Network} title="One fleet, no guesswork" detail="See connection health, last-seen state, and message volume without opening a dozen tabs." /><LandingFeature icon={ShieldCheck} title="Controls with guardrails" detail="Pair, connect, disconnect, and log out with clear state and deliberate confirmation." /><LandingFeature icon={Activity} title="A record you can trust" detail="Every important session change lands in an activity trail your team can actually read." /></div></section><section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28"><div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start"><div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Built for the shift</div><h2 className="mt-3 max-w-md text-3xl font-extrabold leading-tight tracking-[-0.06em] text-[#192735] sm:text-4xl">Operational clarity is a feature.</h2></div><div className="grid gap-5 sm:grid-cols-2"><div className="rounded-2xl border border-[#d8e2d9] bg-[#fbfcf8] p-5"><div className="font-mono text-xs text-[#78907e]">01 / monitor</div><h3 className="mt-7 text-lg font-extrabold tracking-[-0.03em] text-[#243731]">Know what is healthy before someone asks.</h3><p className="mt-3 text-sm leading-6 text-[#71807a]">The overview is organized around the decisions operators make: what is online, what needs attention, and what changed.</p></div><div className="rounded-2xl border border-[#d8e2d9] bg-[#203c36] p-5 text-white"><div className="font-mono text-xs text-[#aabd8a]">02 / move safely</div><h3 className="mt-7 text-lg font-extrabold tracking-[-0.03em]">Fast actions. No ambiguous buttons.</h3><p className="mt-3 text-sm leading-6 text-white/60">Connection controls show their consequences, stay close to the current state, and leave a clean trail behind.</p></div></div></div></section></main><footer className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-[#dce5dc] px-5 py-7 text-xs text-[#7d8984] sm:flex-row sm:items-center sm:justify-between sm:px-8"><Wordmark /><span>© 2025 Relayroom. A quieter way to operate.</span></footer></div>;
}

function LandingFeature({ icon: Icon, title, detail }: { icon: typeof Network; title: string; detail: string }) {
  return <div><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d4e3c0] text-primary"><Icon className="h-4 w-4" /></div><h3 className="mt-4 font-extrabold tracking-[-0.025em] text-[#283d36]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#71807a]">{detail}</p></div>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isSignUp = mode === 'sign-up';
  const submit = (event: FormEvent) => { event.preventDefault(); localStorage.setItem('relayroom-authenticated', 'true'); setLocation('/dashboard'); };
  return <div className="grid min-h-[100dvh] bg-[#edf3ed] lg:grid-cols-[0.9fr_1.1fr]"><div className="hidden flex-col justify-between bg-[#203c36] p-10 text-white lg:flex"><div><Wordmark inverse /><div className="mt-24 max-w-sm"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b3c68f]">relayroom / secure access</div><h1 className="mt-4 text-5xl font-extrabold leading-[0.98] tracking-[-0.07em]">A calmer shift starts with a clearer room.</h1><p className="mt-6 text-sm leading-7 text-white/60">One operator console for the WhatsApp accounts your team depends on.</p></div></div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35"><ShieldCheck className="h-3.5 w-3.5 text-[#d5ee70]" /> encrypted workspace access</div></div><div className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-[430px]"><div className="mb-8 lg:hidden"><Wordmark /></div><div className="rounded-2xl border border-[#d6e0d6] bg-[#fbfcf8] p-6 shadow-[0_25px_60px_-35px_rgba(30,57,47,0.45)] sm:p-8"><div className="mb-7"><div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#e4efd0] text-primary"><Link2 className="h-5 w-5" /></div><h2 className="text-2xl font-extrabold tracking-[-0.05em]">{isSignUp ? 'Create your workspace' : 'Welcome back, operator'}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{isSignUp ? 'Start with a secure place to run your connection fleet.' : 'Sign in to see the current state of your fleet.'}</p></div><form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold">Email address</span><input data-testid="input-auth-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><label className="block"><span className="mb-1.5 flex items-center justify-between text-xs font-bold">Password {isSignUp && <span className="font-normal text-muted-foreground">8+ characters</span>}</span><input data-testid="input-auth-password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label><button data-testid="button-auth-submit" type="submit" className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/90">{isSignUp ? 'Create workspace' : 'Sign in'} <ArrowRight className="h-4 w-4" /></button></form><div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" /></div><button data-testid="button-auth-sso" onClick={() => { localStorage.setItem('relayroom-authenticated', 'true'); setLocation('/dashboard'); }} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-bold hover:bg-secondary"><Sparkles className="h-4 w-4 text-primary" /> Continue with SSO</button><p className="mt-6 text-center text-xs text-muted-foreground">{isSignUp ? 'Already have access?' : 'New to Relayroom?'} <Link href={isSignUp ? '/sign-in' : '/sign-up'} data-testid="link-auth-switch" className="font-bold text-primary hover:underline">{isSignUp ? 'Sign in' : 'Create an account'}</Link></p></div><p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">By continuing, you agree to keep your workspace access safe and private.</p></div></div></div>;
}

function ClerkAuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  return (
    <div className="grid min-h-[100dvh] bg-[#edf3ed] lg:grid-cols-[0.9fr_1.1fr]">
      <div className="hidden flex-col justify-between bg-[#203c36] p-10 text-white lg:flex">
        <div>
          <Wordmark inverse />
          <div className="mt-24 max-w-sm">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b3c68f]">relayroom / secure access</div>
            <h1 className="mt-4 text-5xl font-extrabold leading-[0.98] tracking-[-0.07em]">A calmer shift starts with a clearer room.</h1>
            <p className="mt-6 text-sm leading-7 text-white/60">One operator console for the WhatsApp accounts your team depends on.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35"><ShieldCheck className="h-3.5 w-3.5 text-[#d5ee70]" /> encrypted workspace access</div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px]">
          <div className="mb-8 lg:hidden"><Wordmark /></div>
          {isSignUp ? (
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          ) : (
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          )}
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></div>;
  return isSignedIn ? <Redirect to="/dashboard" /> : <LandingPage />;
}

function PortalRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="h-8 w-8 animate-pulse rounded-full bg-accent" /></div>;
  return isSignedIn ? <AppShell>{children}</AppShell> : <Redirect to="/" />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useMemo(() => ({ value: undefined as string | null | undefined }), []);

  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.value !== undefined && previousUserId.value !== userId) queryClient.clear();
    previousUserId.value = userId;
  }), [addListener, previousUserId, queryClient]);

  return null;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={HomeRedirect} /><Route path="/sign-in/*?" component={() => <ClerkAuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <ClerkAuthPage mode="sign-up" />} /><Route path="/dashboard" component={() => <PortalRoute><DashboardPage /></PortalRoute>} /><Route path="/sessions" component={() => <PortalRoute><SessionsPage /></PortalRoute>} /><Route path="/sessions/:id" component={() => <PortalRoute><SessionDetailPage /></PortalRoute>} /><Route path="/activity" component={() => <PortalRoute><ActivityPage /></PortalRoute>} /><Route path="/settings" component={() => <PortalRoute><SettingsPage /></PortalRoute>} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={(to) => window.history.pushState({}, '', to)} routerReplace={(to) => window.history.replaceState({}, '', to)}><QueryClientProvider client={queryClient}><TooltipProvider><ClerkQueryClientCacheInvalidator /><Router /><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider></WouterRouter>;
}

export default App;