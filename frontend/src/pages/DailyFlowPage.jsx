import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Receipt, ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, Scale, ArrowLeft } from "lucide-react";
import { DayPicker } from "@/components/daybook/DayPicker";
import { FlowTable } from "@/components/daybook/FlowTable";
import { CashCount } from "@/components/daybook/CashCount";
import { CashSummary, ProfitBox } from "@/components/daybook/CashSummary";
import { Reports } from "@/components/daybook/Reports";
import { MONTHS, todayLocal } from "@/components/daybook/util";

const Card = ({ icon: Icon, label, value, tone = "text-slate-900", tid }) => (
  <div className="stat-card p-4" data-testid={tid}>
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono-pd text-slate-500"><Icon className="w-4 h-4" /> {label}</div>
    <div className={`text-xl md:text-2xl font-extrabold mt-1 font-mono-pd ${tone}`}>{value}</div>
  </div>
);

export default function DailyFlowPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState(null);
  const load = useCallback(() => api.get("/daybook/day", { params: { date } }).then(({ data: d }) => setData(d)), [date]);
  useEffect(() => { load(); }, [load]);

  const [y, m, d] = date.split("-");
  const s = data?.summary;
  const diff = data?.count?.difference;
  return (
    <div className="p-4 md:p-8 pb-28 max-w-[1600px] mx-auto space-y-5" data-testid="daily-flow-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Qarkullimet Ditore</h1>
          <p className="text-sm text-slate-500 mt-1" data-testid="daybook-selected-date">Shitje Vendore · {Number(d)} {MONTHS[Number(m) - 1]} {y}</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/sale/new")} data-testid="daybook-back-to-sale"><ArrowLeft className="w-4 h-4 mr-1" /> Shitja vendore</Button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card icon={Receipt} label="Qarkullimi i Ditës" value={eur(data.turnover)} tid="card-turnover" />
          <Card icon={ArrowDownCircle} label="Të Hyrat Cash" value={eur(s.cash_in)} tone="text-emerald-600" tid="card-cash-in" />
          <Card icon={ArrowUpCircle} label="Daljet Cash" value={eur(s.cash_out)} tone="text-rose-600" tid="card-cash-out" />
          <Card icon={Wallet} label="Gjendja e Arkës" value={data.closing_cash == null ? "—" : eur(data.closing_cash)} tid="card-cash-balance" />
          <Card icon={TrendingUp} label="Fitimi/Humbja Ditore" value={`${eur(s.net_profit)}${s.profit_incomplete ? " *" : ""}`} tone={s.net_profit >= 0 ? "text-emerald-600" : "text-rose-600"} tid="card-profit" />
          <Card icon={Scale} label="Diferenca e Arkës" value={diff == null ? "—" : eur(diff)} tone={diff == null || Math.abs(diff) < 0.005 ? "text-slate-900" : diff < 0 ? "text-rose-600" : "text-amber-600"} tid="card-cash-diff" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5 items-start">
        <DayPicker date={date} onChange={setDate} firstYear={Number((data?.settings?.start_date || "2026").slice(0, 4))} />
        {data ? <FlowTable date={date} entries={data.entries} summary={s} onChange={load} /> : <div className="stat-card p-10 text-center text-slate-500">Duke u ngarkuar…</div>}
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <CashCount date={date} count={data.count} expected={data.closing_cash} onSaved={load} />
          <CashSummary data={data} onChange={load} />
          <ProfitBox s={s} />
        </div>
      )}

      <Reports key={date.slice(0, 7)} date={date} />
    </div>
  );
}
