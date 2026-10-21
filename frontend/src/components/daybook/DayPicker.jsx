import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { MONTHS, daysInMonth, pad, todayLocal, inp } from "./util";

export const DayPicker = ({ date, onChange, firstYear = 2026 }) => {
  const [y, m, d] = date.split("-").map(Number);
  const nowY = new Date().getFullYear();
  const years = [];
  for (let i = Math.min(firstYear, y); i <= Math.max(nowY + 2, y); i++) years.push(i);
  const set = (yy, mm, dd) => onChange(`${yy}-${pad(mm)}-${pad(Math.min(dd, daysInMonth(yy, mm - 1)))}`);
  const shift = (n) => { const t = new Date(y, m - 1, d + n); set(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
  const count = daysInMonth(y, m - 1);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const today = todayLocal();

  return (
    <div className="stat-card p-4" data-testid="daybook-calendar">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <CalendarDays className="w-5 h-5 text-emerald-600" />
        <Select value={String(y)} onValueChange={(v) => set(Number(v), m, d)}>
          <SelectTrigger className={`${inp} w-28`} data-testid="daybook-year-select"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((yy) => <SelectItem key={yy} value={String(yy)}>{yy}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(m)} onValueChange={(v) => set(y, Number(v), d)}>
          <SelectTrigger className={`${inp} w-36`} data-testid="daybook-month-select"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-1 ml-auto">
          <Button size="icon" variant="outline" onClick={() => shift(-1)} data-testid="daybook-prev-day"><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => onChange(today)} data-testid="daybook-today-btn">Sot</Button>
          <Button size="icon" variant="outline" onClick={() => shift(1)} data-testid="daybook-next-day"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 mb-1">
        {["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"].map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: count }).map((_, i) => {
          const day = i + 1;
          const iso = `${y}-${pad(m)}-${pad(day)}`;
          const active = day === d;
          return (
            <button key={day} onClick={() => set(y, m, day)} data-testid={`daybook-day-${day}`}
              className={`h-9 rounded-md text-sm font-semibold transition-colors ${active ? "bg-emerald-600 text-white" : iso === today ? "border border-emerald-500 text-emerald-700" : "hover:bg-slate-100 text-slate-700"}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};
