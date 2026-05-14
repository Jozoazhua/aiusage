import { useState, useRef, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import type { Locale, T } from '../i18n';

interface DateRangePickerProps {
  range: string;
  dateFrom: string;
  dateTo: string;
  onChange: (update: { range: string; dateFrom: string; dateTo: string }) => void;
  locale: Locale;
  t: T;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toDate(str: string): Date | undefined {
  if (!str) return undefined;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toStr(date: Date | undefined): string {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = localToday();
  d.setDate(d.getDate() - n);
  return d;
}

function presetDates(range: string): { from: Date | undefined; to: Date | undefined } {
  const today = localToday();
  if (range === 'today') return { from: today, to: today };
  if (range === '7d')    return { from: daysAgo(6),  to: today };
  if (range === '14d')   return { from: daysAgo(13), to: today };
  if (range === '30d')   return { from: daysAgo(29), to: today };
  return { from: undefined, to: undefined };
}

function formatDate(str: string, locale: Locale): string {
  const d = toDate(str);
  if (!d) return '──';
  const loc = locale === 'zh' ? 'zh-CN' : 'en-US';
  return d.toLocaleDateString(loc, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function triggerLabel(range: string, dateFrom: string, dateTo: string, t: T, locale: Locale): string {
  if (range === 'all')    return t.all;
  if (range === 'today')  return t.rangeToday;
  if (range === '7d')     return t.range7d;
  if (range === '14d')    return t.range14d;
  if (range === '30d')    return t.range30d;
  if (range === '90d')    return t.range90d;
  if (range === 'month')  return t.thisMonth;
  if (range === 'custom' && dateFrom && dateTo) {
    const loc = locale === 'zh' ? 'zh-CN' : 'en-US';
    const fmt = (s: string) => toDate(s)?.toLocaleDateString(loc, { month: 'short', day: 'numeric' }) ?? '';
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  }
  return t.customRange;
}

// ── component ─────────────────────────────────────────────────────────────────

export function DateRangePicker({ range, dateFrom, dateTo, onChange, locale, t }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState(range);
  const [tempSelected, setTempSelected] = useState<DateRange>({
    from: toDate(dateFrom), to: toDate(dateTo),
  });
  const ref = useRef<HTMLDivElement>(null);
  const today = localToday();
  const rdpLocale = locale === 'zh' ? 'zh-CN' : 'en-US';

  // Sync temp state when panel opens
  useEffect(() => {
    if (!open) return;
    setTempRange(range);
    if (range === 'custom') {
      setTempSelected({ from: toDate(dateFrom), to: toDate(dateTo) });
    } else {
      setTempSelected(presetDates(range));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePreset = (r: string) => {
    onChange({ range: r, dateFrom: '', dateTo: '' });
    setOpen(false);
  };

  const handleDaySelect = (selected: DateRange | undefined) => {
    setTempRange('custom');
    setTempSelected(selected ?? { from: undefined, to: undefined });
  };

  const handleConfirm = () => {
    if (tempRange === 'custom') {
      onChange({ range: 'custom', dateFrom: toStr(tempSelected.from), dateTo: toStr(tempSelected.to) });
    } else {
      onChange({ range: tempRange, dateFrom: '', dateTo: '' });
    }
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  // Determine if end-date is being selected (from set, to not yet)
  const isSelectingEnd = !!(tempSelected.from && !tempSelected.to);

  const PRESETS = [
    { value: 'all',   label: t.all },
    { value: 'today', label: t.rangeToday },
    { value: '7d',    label: t.range7d },
    { value: '14d',   label: t.range14d },
    { value: '30d',   label: t.range30d },
    { value: '90d',   label: t.range90d },
  ];

  const activeBtn  = 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900';
  const inactiveBtn = 'border border-slate-200 text-slate-600 hover:border-slate-400 dark:border-[#333] dark:text-slate-400 dark:hover:border-slate-500';

  const rdpClassNames = {
    root: '',
    months: 'flex',
    month: 'w-full',
    month_caption: 'flex items-center justify-between px-1 pb-3',
    caption_label: 'text-[13px] font-semibold text-slate-700 dark:text-slate-300',
    nav: 'flex gap-1',
    button_previous: 'rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-300 transition-colors',
    button_next: 'rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-300 transition-colors disabled:opacity-25 disabled:cursor-default',
    weeks: '',
    weekdays: 'grid grid-cols-7 mb-1',
    weekday: 'text-center text-[11px] font-medium text-slate-400 py-1',
    week: 'grid grid-cols-7',
    day: 'flex h-8 items-center justify-center text-[12px] relative',
    day_button: 'h-7 w-7 rounded-full flex items-center justify-center font-medium transition-colors focus:outline-none',
    today: 'ring-1 ring-slate-400 dark:ring-slate-500 rounded-full',
    selected: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-full',
    range_start: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-l-full',
    range_end: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-r-full',
    range_middle: 'bg-slate-100 dark:bg-[#2a2a2a] rounded-none text-slate-700 dark:text-slate-300',
    outside: 'opacity-30',
    disabled: 'opacity-25 cursor-default',
    hidden: 'invisible',
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 ${
          open || range !== 'all'
            ? 'bg-white text-slate-900 shadow-sm dark:bg-[#222222] dark:text-slate-300'
            : 'bg-slate-100/80 text-slate-400 hover:text-slate-600 dark:bg-[#1a1a1a]/80 dark:text-slate-500 dark:hover:text-slate-300'
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span>{triggerLabel(range, dateFrom, dateTo, t, locale)}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[520px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#161616]">

          {/* Presets */}
          <div className="flex gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#222]">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-150 ${
                  tempRange === p.value ? activeBtn : inactiveBtn
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Body: date boxes + calendar */}
          <div className="flex gap-0">
            {/* Left: date boxes */}
            <div className="flex w-44 shrink-0 flex-col gap-3 border-r border-slate-100 p-4 dark:border-[#222]">
              {/* Start */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-slate-400">{t.dateStart}</p>
                <div className={`rounded-xl border-2 px-3 py-2.5 transition-colors ${
                  tempSelected.from && !isSelectingEnd
                    ? 'border-slate-800 bg-slate-50 dark:border-slate-300 dark:bg-[#222]'
                    : 'border-slate-200 dark:border-[#333]'
                }`}>
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                    {tempSelected.from ? formatDate(toStr(tempSelected.from), locale) : '──'}
                  </p>
                </div>
              </div>
              {/* End */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-slate-400">{t.dateEnd}</p>
                <div className={`rounded-xl border-2 px-3 py-2.5 transition-colors ${
                  isSelectingEnd
                    ? 'border-slate-800 bg-slate-50 dark:border-slate-300 dark:bg-[#222]'
                    : 'border-slate-200 dark:border-[#333]'
                }`}>
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                    {tempSelected.to ? formatDate(toStr(tempSelected.to), locale) : (isSelectingEnd ? <span className="animate-pulse">…</span> : '──')}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: calendar */}
            <div className="flex-1 p-3">
              <DayPicker
                mode="range"
                selected={tempSelected}
                onSelect={handleDaySelect}
                disabled={{ after: today }}
                defaultMonth={tempSelected.from ?? today}
                locale={rdpLocale as never}
                classNames={rdpClassNames}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-[#222]">
            <button
              onClick={handleCancel}
              className="rounded-lg px-4 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#222] transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={tempRange === 'custom' && (!tempSelected.from || !tempSelected.to)}
              className="rounded-lg bg-slate-800 px-5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              {t.confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
