import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RotateCw, Github, Sun, Moon, Monitor } from 'lucide-react';
import type { Locale, T } from './i18n';
import { I18N, getStoredLocale } from './i18n';
import type { ThemeMode } from './theme';
import { getStoredTheme, applyTheme } from './theme';
import { TOKEN_SERIES, getChartColors, getTokenColor, providerLabel, formatProductLabel } from './constants';
import { useIsDark } from './hooks/use-dark';
import {
  formatUsd, formatUsdFull, formatCompact, formatNumber, formatPercent,
  formatModelName, shortDate, longDate, arrSum, foldItems,
} from './utils/format';
import type { FiltersState, FacetOption } from './hooks/use-overview';
import { useOverview } from './hooks/use-overview';
import { ChartBoundary, EmptyState, Skeleton, SectionHeader, ChartLegend, DataGuard } from './components/chart-helpers';
// ChartBoundary + EmptyState still used in Share section
import { KpiCard, CostKpiCard } from './components/kpi-card';
import { useFetchCnyRate, useCurrencyStore } from './hooks/use-cny-rate';
import { CostTrendChart } from './components/cost-trend-chart';
import { TokenTrendChart } from './components/token-trend-chart';
import { TokenCompositionChart } from './components/token-composition-chart';
import { FlowChart } from './components/flow-chart';
import { DonutSection } from './components/donut-section';
import { ActivityHeatmap } from './components/activity-heatmap';
import { buildActivityHeatmapData } from './utils/activity-heatmap-data';
import { HeaderLogo, useFaviconFromLogo } from './components/site-logo';
import { DateRangePicker } from './components/date-range-picker';
import { SITE_TITLE } from './site-config';

// ────────────────────────────────────────
// Constants
// ────────────────────────────────────────

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ────────────────────────────────────────
// Theme & Language Toggles
// ────────────────────────────────────────

const THEME_OPTIONS: { value: ThemeMode; icon: typeof Sun }[] = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

const THEME_LABELS: Record<ThemeMode, { en: string; zh: string }> = {
  system: { en: 'System', zh: '系统' },
  light: { en: 'Light', zh: '日间' },
  dark: { en: 'Dark', zh: '夜间' },
};

function ThemeToggle({ value, onChange, locale }: { value: ThemeMode; onChange: (v: ThemeMode) => void; locale: Locale }) {
  return (
    <div className="inline-flex items-center rounded-md bg-[var(--ai-surface-muted)] p-0.5">
      {THEME_OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
              value === o.value
                ? 'bg-[var(--ai-surface)] text-[var(--ai-text)] shadow-sm'
                : 'text-[var(--ai-muted)] hover:text-[var(--ai-text)]'
            }`}
            aria-label={o.value}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{THEME_LABELS[o.value][locale]}</span>
          </button>
        );
      })}
    </div>
  );
}

function LangToggle({ value, onChange }: { value: Locale; onChange: (v: Locale) => void }) {
  return (
    <div className="inline-flex items-center rounded-md bg-[var(--ai-surface-muted)] p-0.5">
      {(['en', 'zh'] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-all duration-150 ${
            value === l
              ? 'bg-[var(--ai-surface)] text-[var(--ai-text)] shadow-sm'
              : 'text-[var(--ai-muted)] hover:text-[var(--ai-text)]'
          }`}
        >
          {l === 'en' ? 'EN' : '中'}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────
// Controls
// ────────────────────────────────────────

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-[var(--ai-surface-muted)] p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
            value === o.value
              ? 'bg-[var(--ai-surface)] text-[var(--ai-text)] shadow-sm'
              : 'text-[var(--ai-muted)] hover:text-[var(--ai-text)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterTabs({
  value,
  options,
  onChange,
  allLabel = 'All',
  tooltips,
}: {
  value: string;
  options: FacetOption[];
  onChange: (v: string) => void;
  allLabel?: string;
  tooltips?: Record<string, string>;
}) {
  if (!options.length) return null;
  const activeClass = 'bg-[var(--ai-surface)] text-[var(--ai-text)] shadow-sm';
  const inactiveClass = 'text-[var(--ai-muted)] hover:text-[var(--ai-text)]';
  return (
    <div className="inline-flex items-center rounded-lg bg-[var(--ai-surface-muted)] p-0.5 flex-nowrap">
      <button
        onClick={() => onChange('')}
        className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
          !value ? activeClass : inactiveClass
        }`}
      >
        {allLabel}
      </button>
      {options.map((o) => {
        const tip = tooltips?.[o.value];
        return (
          <span key={o.value} className={tip ? 'group relative' : ''}>
            <button
              onClick={() => onChange(o.value === value ? '' : o.value)}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
                value === o.value ? activeClass : inactiveClass
              }`}
            >
              {formatProductLabel(o.label)}
            </button>
            {tip && (
              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-[11px] leading-relaxed text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-700">
                {tip}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function FilterChips({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  tooltips,
}: {
  label: string;
  value: string;
  options: FacetOption[];
  onChange: (v: string) => void;
  allLabel?: string;
  tooltips?: Record<string, string>;
}) {
  if (!options.length) return null;
  const active = 'bg-[var(--ai-text)] text-[var(--ai-bg)]';
  const inactive = 'bg-[var(--ai-surface)] text-[var(--ai-muted)] border border-[var(--ai-border)]';
  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && <span className="shrink-0 text-[12px] font-medium text-[var(--ai-muted)]">{label}</span>}
      <div className="relative min-w-0 flex-1">
        <div className="overflow-x-auto scrollbar-hide touch-pan-x overscroll-x-contain">
          <div className="flex gap-1.5 w-max pr-4">
            {allLabel && (
              <button
                onClick={() => onChange('')}
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
                  !value ? active : inactive
                }`}
              >
                {allLabel}
              </button>
            )}
            {options.map((o) => {
              const tip = tooltips?.[o.value];
              return (
                <span key={o.value} className={tip ? 'group relative' : ''}>
                  <button
                    onClick={() => onChange(o.value === value ? '' : o.value)}
                    className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
                      value === o.value ? active : inactive
                    }`}
                  >
                    {formatProductLabel(o.label)}
                  </button>
                  {tip && (
                    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-[11px] leading-relaxed text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-700">
                      {tip}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#f7f3ea] dark:from-[#171512]" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────
// App
// ────────────────────────────────────────

export function App() {
  const [filters, setFilters] = useState<FiltersState>({
    range: '30d', deviceId: '', product: '', dateFrom: '', dateTo: '',
  });

  const {
    overview,
    health,
    kpis,
    metricAvailability,
    fOpts,
    loading,
    error,
    isDemo,
    refresh,
  } = useOverview(filters);
  useFetchCnyRate();
  useCurrencyStore(); // subscribe to re-render on toggle
  useFaviconFromLogo();
  const isDark = useIsDark();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);


  // Theme
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);
  const isFirstRender = useRef(true);
  const setTheme = useCallback((m: ThemeMode) => { setThemeState(m); applyTheme(m); }, []);
  useEffect(() => {
    applyTheme(theme, !isFirstRender.current);
    isFirstRender.current = false;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Locale
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('aiusage-locale', l); } catch {}
  }, []);
  const t: T = I18N[locale];
  // Sync document title
  useEffect(() => {
    document.title = SITE_TITLE;
  }, []);

  // Token legend (locale-aware)
  const tokenLegendLabels: Record<string, keyof T> = {
    inputTokens: 'input', cachedInputTokens: 'cached',
    cacheWriteTokens: 'cacheWrite', outputTokens: 'output',
    reasoningOutputTokens: 'reasoning',
  };
  const tokenLegend = useMemo(() => {
    if (!overview) return [];
    const tc = overview.tokenComposition;
    return TOKEN_SERIES.map((s) => ({
      label: t[tokenLegendLabels[s.key] ?? 'input'],
      color: getTokenColor(s, isDark),
      value: formatCompact(arrSum(tc.map((d) => Number(d[s.key] || 0))), locale),
    }));
  }, [overview, t, locale, isDark]);
  const unavailable = metricAvailability.tokenMetricsUnavailable;
  const activityHeatmap = useMemo(() => buildActivityHeatmapData({
    heatmap: overview?.heatmap ?? [],
    dailyTrend: overview?.dailyTrend ?? [],
    tokenMetricsUnavailable: unavailable,
  }), [overview, unavailable]);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">

      {/* ── Header ── */}
      <header className="fade-up relative z-20 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <h1 className="flex items-center gap-2 text-[18px] sm:text-[22px] font-semibold tracking-tight text-[var(--ai-text)]">
            <HeaderLogo />
            {SITE_TITLE}
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <ThemeToggle value={theme} onChange={setTheme} locale={locale} />
            <LangToggle value={locale} onChange={setLocale} />
            <button
              onClick={refresh}
              className="hidden sm:inline-flex items-center justify-center rounded-md bg-[var(--ai-surface-muted)] p-1.5 text-[var(--ai-muted)] transition-colors hover:text-[var(--ai-text)]"
              aria-label="Refresh"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

      </header>

        {/* ── Range + Filters (desktop) ── */}
        <div className="mt-2 mb-6 hidden sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
          <div className="flex items-center gap-2">
            <DateRangePicker
              range={filters.range}
              dateFrom={filters.dateFrom ?? ''}
              dateTo={filters.dateTo ?? ''}
              onChange={({ range, dateFrom, dateTo }) => setFilters((f) => ({ ...f, range, dateFrom, dateTo }))}
              locale={locale}
              t={t}
            />
          </div>
          {overview && fOpts.products.length > 1 && (
            <>
              <div className="h-5 w-px bg-[var(--ai-border)]" />
              <FilterTabs
                value={filters.product}
                options={fOpts.products}
                allLabel={t.all}
                onChange={(v) => setFilters((f) => ({ ...f, product: v }))}
                tooltips={{ 'claude-code': t.claudeCodeDataNotice }}
              />
            </>
          )}
          {overview && fOpts.devices.length >= 1 && (
            <>
              <div className="h-5 w-px bg-[var(--ai-border)]" />
              <FilterTabs
                value={filters.deviceId}
                options={fOpts.devices}
                allLabel={t.all}
                onChange={(v) => setFilters((f) => ({ ...f, deviceId: v }))}
              />
            </>
          )}
        </div>

        {/* ── Filters (mobile) ── */}
        <div className="mt-1 mb-5 flex flex-col gap-3 sm:hidden">
          <DateRangePicker
            range={filters.range}
            dateFrom={filters.dateFrom ?? ''}
            dateTo={filters.dateTo ?? ''}
            onChange={({ range, dateFrom, dateTo }) => setFilters((f) => ({ ...f, range, dateFrom, dateTo }))}
            locale={locale}
            t={t}
          />
          {overview && fOpts.products.length > 1 && (
            <FilterChips
              label=""
              value={filters.product}
              options={fOpts.products}
              allLabel={t.all}
              onChange={(v) => setFilters((f) => ({ ...f, product: v }))}
              tooltips={{ 'claude-code': t.claudeCodeDataNotice }}
            />
          )}
          {overview && fOpts.devices.length >= 1 && (
            <FilterChips
              label=""
              value={filters.deviceId}
              options={fOpts.devices}
              allLabel={t.all}
              onChange={(v) => setFilters((f) => ({ ...f, deviceId: v }))}
            />
          )}
        </div>

      {/* ── Content ── */}
      {loading && !overview ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sa-${i}`} className="card px-5 py-5">
                <Skeleton className="mb-3 h-2.5 w-14" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sb-${i}`} className="card px-5 py-5">
                <Skeleton className="mb-3 h-2.5 w-14" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="card p-6"><Skeleton className="h-[280px]" /></div>
          <div className="card p-6"><Skeleton className="h-[280px]" /></div>
        </div>
      ) : error ? (
        <div className="card flex min-h-[320px] flex-col items-center justify-center p-8">
          <div className="mb-1.5 text-[13px] text-[var(--ai-muted)]">{t.failedToLoad}</div>
          <div className="text-[13px] text-red-500/80">{error}</div>
        </div>
      ) : (
        <div className="grid gap-4">

          {/* ── KPI Row 1 ── */}
          <div
            className="fade-up grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            style={{ animationDelay: '50ms' }}
          >
            <div className="card col-span-2 sm:col-span-1">
              <CostKpiCard
                label={t.estimatedCost}
                value={unavailable ? t.unavailable : formatUsd(overview?.totalCostUsd ?? 0)}
              />
            </div>
            <div className="card">
              <KpiCard label={t.totalTokens} value={unavailable ? t.unavailable : formatCompact(kpis?.totalTokens ?? 0, locale)} />
            </div>
            <div className="card">
              <KpiCard label={t.inputTokens} value={unavailable ? t.unavailable : formatCompact(kpis?.inputTokens ?? 0, locale)} />
            </div>
            <div className="card">
              <KpiCard label={t.outputTokens} value={unavailable ? t.unavailable : formatCompact(kpis?.outputTokens ?? 0, locale)} />
            </div>
            <div className="card">
              <KpiCard label={t.cachedTokens} value={unavailable ? t.unavailable : formatCompact(kpis?.cachedTokens ?? 0, locale)} />
            </div>
          </div>

          {/* ── KPI Row 2 ── */}
          <div
            className="fade-up grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            style={{ animationDelay: '100ms' }}
          >
            <div className="card col-span-2 sm:col-span-1">
              <KpiCard
                label={t.activeDays}
                value={String(overview?.activeDays ?? 0)}
                suffix={` / ${overview?.totalDays ?? 0}`}
              />
            </div>
            <div className="card">
              <KpiCard
                label={t.sessions}
                value={formatNumber((overview?.totalSessions ?? 0) > 0 ? overview!.totalSessions : (overview?.totalEvents ?? 0))}
                suffix={(overview?.totalSessions ?? 0) > 0 && overview!.totalSessions !== overview!.totalEvents ? ` / ${formatNumber(overview!.totalEvents)}` : undefined}
              />
            </div>
            <div className="card">
              <KpiCard label={t.costPerSession} value={unavailable ? t.unavailable : formatUsd(kpis?.costPerSession ?? 0)} />
            </div>
            <div className="card">
              <KpiCard label={t.avgDailyCost} value={unavailable ? t.unavailable : formatUsd(overview?.averageDailyCostUsd ?? 0)} />
            </div>
            <div className="card">
              <KpiCard label={t.cacheHitRate} value={unavailable ? t.unavailable : formatPercent(kpis?.cacheHitRate ?? 0)} />
            </div>
          </div>

          {unavailable && (
            <div className="fade-up rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-950/60 dark:bg-amber-950/20 dark:text-amber-200">
              <span className="font-medium">{t.eventOnlySource}.</span> {t.eventOnlyNotice}
            </div>
          )}

          {/* ── Activity Heatmap ── */}
          <div className="card fade-up p-6" style={{ animationDelay: '120ms' }}>
            <SectionHeader title={t.activityHeatmap} />
            <ActivityHeatmap days={activityHeatmap.days} metricLabel={activityHeatmap.metricLabel} locale={locale} />
          </div>

          {/* ── Cost Trend ── */}
          <div className="card fade-up p-6" style={{ animationDelay: '150ms' }}>
            <SectionHeader title={t.costTrend} stat={unavailable ? t.unavailable : formatUsd(overview?.totalCostUsd ?? 0)} />
            <DataGuard unavailable={unavailable} label={t.costUnavailable} name="Cost Trend">
              <CostTrendChart
                data={overview?.dailyTrend ?? []}
                providerTrend={overview?.providerDailyTrend ?? []}
                noDataLabel={t.noData}
              />
            </DataGuard>
          </div>

          {/* ── Token Trend ── */}
          <div className="card fade-up p-6" style={{ animationDelay: '200ms' }}>
            <SectionHeader title={t.tokenTrend} stat={unavailable ? t.unavailable : formatCompact(kpis?.totalTokens ?? 0, locale)} />
            <DataGuard unavailable={unavailable} label={t.tokenUnavailable} name="Token Trend">
              <TokenTrendChart data={overview?.tokenComposition ?? []} locale={locale} noDataLabel={t.noData} />
              <ChartLegend items={tokenLegend} />
            </DataGuard>
          </div>

          {/* ── Token Composition ── */}
          <div className="card fade-up p-6" style={{ animationDelay: '250ms' }}>
            <SectionHeader title={t.tokenComposition} stat={unavailable ? t.unavailable : undefined} />
            <DataGuard unavailable={unavailable} label={t.tokenUnavailable} name="Token Composition">
              <TokenCompositionChart data={overview?.tokenComposition ?? []} locale={locale} noDataLabel={t.noData} />
              <ChartLegend items={tokenLegend} />
            </DataGuard>
          </div>

          {/* ── Flow & Share ── */}
          <div className="fade-up grid gap-4 lg:grid-cols-5" style={{ animationDelay: '300ms' }}>
            <div className="card p-6 lg:col-span-3">
              <SectionHeader title={t.tokenFlow} />
              <DataGuard unavailable={unavailable} label={t.tokenUnavailable} name="Token Flow">
                <FlowChart data={overview?.sankey} />
              </DataGuard>
            </div>
            <div className="card flex flex-col p-6 lg:col-span-2">
              {unavailable ? (
                <EmptyState label={t.shareUnavailable} />
              ) : (
                <ChartBoundary name="Share">
                  <div className="flex flex-1 flex-col">
                    <DonutSection
                      title={t.providerShare}
                      data={(overview?.filters.options.providers ?? []).map((p) => ({
                        value: p.value,
                        label: providerLabel(p.value),
                        estimatedCostUsd: p.estimatedCostUsd,
                        eventCount: p.eventCount,
                      }))}
                      colors={getChartColors(isDark)}
                      centerLabel={formatUsd(overview?.totalCostUsd ?? 0)}
                    />
                    <div className="my-5 border-t border-[var(--ai-border)]" />
                    <DonutSection
                      title={t.modelShare}
                      data={(overview?.modelCostShare ?? []).map((m) => ({ ...m, label: formatModelName(m.label, isMobile) }))}
                      colors={getChartColors(isDark)}
                      centerLabel={formatUsd(overview?.totalCostUsd ?? 0)}
                    />
                    <div className="my-5 border-t border-[var(--ai-border)]" />
                    <DonutSection
                      title={t.deviceShare}
                      data={(overview?.filters.options.devices ?? []).map((d) => ({
                        value: d.value,
                        label: d.label,
                        estimatedCostUsd: d.estimatedCostUsd,
                        eventCount: d.eventCount,
                      }))}
                      colors={getChartColors(isDark)}
                      centerLabel={formatUsd(overview?.totalCostUsd ?? 0)}
                    />
                  </div>
                </ChartBoundary>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── Footer ── */}
      <footer className="fade-up mt-16 border-t border-[var(--ai-border)] pb-10 pt-8">
        <div className="flex flex-col items-center gap-4">
          {health?.version && (
            <span className="rounded-full bg-[var(--ai-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--ai-muted)]">
              v{health.version}
            </span>
          )}
          <div className="flex items-center gap-4 text-[11px]">
            <a
              href="/pricing"
              className="text-[var(--ai-muted)] transition-colors hover:text-[var(--ai-text)]"
            >
              {t.pricing}
            </a>
            <span className="h-3 w-px bg-[var(--ai-border)]" />
            <a
              href="/embed/docs"
              className="text-[var(--ai-muted)] transition-colors hover:text-[var(--ai-text)]"
            >
              {t.embedWidgets}
            </a>
            <span className="h-3 w-px bg-[var(--ai-border)]" />
            <a
              href="https://github.com/Jozoazhua/aiusage"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[var(--ai-muted)] transition-colors hover:text-[var(--ai-text)]"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
