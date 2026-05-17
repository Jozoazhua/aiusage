import { useState, useRef, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
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

function presetDates(r: string): { from: Date | undefined; to: Date | undefined } {
  const today = localToday();
  if (r === 'today') return { from: today, to: today };
  if (r === '7d')    return { from: daysAgo(6),  to: today };
  if (r === '30d')   return { from: daysAgo(29), to: today };
  return { from: undefined, to: undefined };
}

function customLabel(dateFrom: string, dateTo: string, locale: Locale): string {
  if (!dateFrom || !dateTo) return '';
  const loc = locale === 'zh' ? 'zh-CN' : 'en-US';
  const fmt = (s: string) =>
    toDate(s)?.toLocaleDateString(loc, { month: 'short', day: 'numeric' }) ?? '';
  return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
}

// ── component ─────────────────────────────────────────────────────────────────

export function DateRangePicker({ range, dateFrom, dateTo, onChange, locale, t }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<DateRange>({
    from: toDate(dateFrom), to: toDate(dateTo),
  });
  const ref = useRef<HTMLDivElement>(null);
  const today = localToday();

  // Sync calendar when panel opens
  useEffect(() => {
    if (!open) return;
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

  const handleConfirm = () => {
    onChange({
      range: 'custom',
      dateFrom: toStr(tempSelected.from),
      dateTo: toStr(tempSelected.to),
    });
    setOpen(false);
  };

  const PRESETS = [
    { value: 'all',   label: t.all },
    { value: 'today', label: t.rangeToday },
    { value: '7d',    label: t.range7d },
    { value: '30d',   label: t.range30d },
  ];

  const active   = 'bg-[var(--ai-surface)] text-[var(--ai-text)] shadow-sm';
  const inactive = 'text-[var(--ai-muted)] hover:text-[var(--ai-text)]';

  const confirmDisabled = !tempSelected.from || !tempSelected.to;

  return (
    <div className="relative" ref={ref}>
      {/* Inline preset pills + custom trigger */}
      <div className="inline-flex items-center rounded-lg bg-[var(--ai-surface-muted)] p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
              range === p.value && !open ? active : inactive
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-150 ${
            open || range === 'custom' ? active : inactive
          }`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>
            {range === 'custom' && dateFrom && dateTo
              ? customLabel(dateFrom, dateTo, locale)
              : t.customRange}
          </span>
        </button>
      </div>

      {/* Calendar panel */}
      {open && (
        <div className="ai-rdp-panel absolute left-0 top-full z-50 mt-2 rounded-2xl border border-[var(--ai-border)] bg-[var(--ai-surface)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="border-b border-[var(--ai-border)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--ai-text)]">
              {locale === 'zh' ? '自定义范围' : 'Custom Range'}
            </p>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <DayPicker
              mode="range"
              navLayout="around"
              selected={tempSelected}
              onSelect={(sel) => setTempSelected(sel ?? { from: undefined, to: undefined })}
              disabled={{ after: today }}
              defaultMonth={tempSelected.from ?? today}
              locale={locale === 'zh' ? 'zh-CN' as never : 'en-US' as never}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--ai-border)] px-4 py-3">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-1.5 text-[13px] font-medium text-[var(--ai-muted)] hover:bg-[var(--ai-surface-muted)] transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className="rounded-lg bg-[var(--ai-text)] px-5 py-1.5 text-[13px] font-medium text-[var(--ai-bg)] transition-colors hover:opacity-80 disabled:opacity-30"
            >
              {t.confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
