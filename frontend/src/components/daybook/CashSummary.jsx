import { useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Settings2, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { DiffBadge } from "./CashCount";
import { inp } from "./util";

const Line = ({ n, label, value, strong, tid, sign = "" }) => (
  <div className={`flex justify-between py-1.5 border-b border-slate-800/40 ${strong ? "font-extrabold text-base" : ""}`}>
    <span><span className="text-slate-400 mr-2 font-mono-pd">{n}.</span>{label}</span>
    <span className="font-mono-pd" data-testid={tid}>{value == null ? "—" : `${sign}${eur(value)}`}</span>
  </div>
);

const OpeningDialog = ({ open, settings, date, onClose, onSaved }) => {
  const [f, setF] = useState({ start_date: settings?.start_date || date, opening_cash: settings?.opening_cash ?? "" });
  const save = async () => {
    try { await api.put("/daybook/settings", { start_date: f.start_date, opening_cash: Number(f.opening_cash) || 0 }); toast.success("Arka fillestare u ruajt"); onClose(); onSaved(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#141C2B] border-slate-800 text-slate-100" data-testid="opening-dialog">
        <DialogHeader><DialogTitle>Arka fillestare</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-400">Nga kjo datë programi fillon të llogarisë arkën dhe e bart gjendjen çdo ditë.</p>
        <div><Label>Data e fillimit</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className={inp} data-testid="opening-date" /></div>
        <div><Label>Paratë në arkë në fillim të asaj dite (€)</Label><Input type="number" step="0.01" value={f.opening_cash} onChange={(e) => setF({ ...f, opening_cash: e.target.value })} className={inp} data-testid="opening-amount" /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Anulo</Button><Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="opening-save">Ruaj</Button></div>
      </DialogContent>
    </Dialog>
  );
};

export const CashSummary = ({ data, onChange }) => {
  const [open, setOpen] = useState(false);
  const s = data.summary;
  const counted = data.count?.total;
  return (
    <div className="stat-card p-4" data-testid="cash-summary">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-600" /><h2 className="font-extrabold text-lg">Arka Ditore</h2></div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="opening-settings-btn"><Settings2 className="w-4 h-4 mr-1" /> Arka fillestare</Button>
      </div>
      {!data.settings.set && <div className="text-xs text-amber-600 mb-2">Vendos arkën fillestare që gjendja të bartet saktë nga dita në ditë.</div>}
      {data.before_start && <div className="text-xs text-amber-600 mb-2">Kjo datë është para fillimit të llogaritjes së arkës ({data.settings.start_date}).</div>}
      <Line n={1} label="Arka në fillim të ditës" value={data.opening_cash} tid="cash-opening" />
      <Line n={2} label="Të hyrat nga shitjet Cash" value={s.cash_sales} sign="+" tid="cash-sales" />
      <Line n={3} label="Arkëtimet e borxheve" value={s.debt_collections} sign="+" tid="cash-collections" />
      {s.manual_in > 0 && <Line n="•" label="Hyrje të tjera (manuale)" value={s.manual_in} sign="+" tid="cash-manual-in" />}
      <Line n={4} label="Daljet për blerje" value={s.purchases_out} sign="−" tid="cash-purchases" />
      <Line n={5} label="Daljet për shpenzime" value={s.expenses_out} sign="−" tid="cash-expenses" />
      <Line n={6} label="Pagesat ndaj furnitorëve" value={s.supplier_payments} sign="−" tid="cash-supplier-payments" />
      {s.returns_out > 0 && <Line n="•" label="Kthimet e parave klientëve" value={s.returns_out} sign="−" tid="cash-returns" />}
      {s.manual_out > 0 && <Line n="•" label="Dalje të tjera (manuale)" value={s.manual_out} sign="−" tid="cash-manual-out" />}
      <Line n={7} label="Arka në fund të ditës" value={data.closing_cash} strong tid="cash-closing" />
      <Line n={8} label="Paratë e numëruara fizikisht" value={counted ?? null} tid="cash-counted" />
      <div className="flex justify-between py-1.5"><span><span className="text-slate-400 mr-2 font-mono-pd">9.</span>Diferenca e arkës</span><span data-testid="cash-difference"><DiffBadge diff={data.count?.difference} /></span></div>
      <div className="mt-2 text-[11px] text-slate-500">Banka (e ndarë nga arka): hyrje {eur(s.bank_in)} · dalje {eur(s.bank_out)}</div>
      <OpeningDialog key={String(open)} open={open} settings={data.settings} date={data.date} onClose={() => setOpen(false)} onSaved={onChange} />
    </div>
  );
};

export const ProfitBox = ({ s }) => {
  const net = s.net_profit;
  return (
    <div className="stat-card p-4" data-testid="profit-box">
      <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-emerald-600" /><h2 className="font-extrabold text-lg">Fitimi ose Humbja e Ditës</h2></div>
      {[["Të ardhurat nga shitjet (pa kthimet)", s.revenue], ["Kostoja e produkteve të shitura", -s.cogs], ["Fitimi bruto", s.gross_profit, true], ["Shpenzimet operative", -s.opex]].map(([l, v, b]) => (
        <div key={l} className={`flex justify-between py-1.5 border-b border-slate-800/40 ${b ? "font-bold" : ""}`}><span>{l}</span><span className="font-mono-pd">{eur(v)}</span></div>
      ))}
      {s.other_income > 0 && <div className="flex justify-between py-1.5 border-b border-slate-800/40"><span>Të ardhura të tjera</span><span className="font-mono-pd">{eur(s.other_income)}</span></div>}
      <div className={`flex justify-between pt-3 text-xl font-extrabold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
        <span>{net >= 0 ? "Fitimi neto" : "Humbja neto"}</span><span className="font-mono-pd" data-testid="profit-net">{eur(net)}</span>
      </div>
      {s.profit_incomplete && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600" data-testid="profit-incomplete">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Fitimi është i paplotë: {s.missing_cost_count} shitje kanë produkte pa çmim blerjeje. Plotësoje te "Korrigjo".
        </div>
      )}
      <div className="text-[11px] text-slate-500 mt-2">Blerja e mallit për stok dhe pagesat e borxheve nuk llogariten si humbje/fitim.</div>
    </div>
  );
};
