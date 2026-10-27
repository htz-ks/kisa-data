import { useCallback, useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Landmark, ArrowLeftRight, Trash2, Scale } from "lucide-react";
import { toast } from "sonner";
import { PaySource, BANKS } from "@/components/BankSelect";
import { todayLocal } from "@/components/daybook/util";

const TransferDialog = ({ open, onClose, onSaved }) => {
  const [f, setF] = useState({ source: "cash", target: "TEB", amount: "", date: todayLocal(), note: "" });
  const save = async () => {
    try { await api.post("/banks/transfers", { ...f, amount: Number(f.amount) }); toast.success("Transferta u regjistrua"); onClose(); onSaved(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Shkruaj shumën"); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#141C2B] border-slate-800 text-slate-100" data-testid="transfer-dialog">
        <DialogHeader><DialogTitle>Depozitim / Tërheqje / Transfertë</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nga</Label><div className="mt-1"><PaySource value={f.source} onChange={(v) => setF({ ...f, source: v })} testId="transfer-source" /></div></div>
          <div><Label>Në</Label><div className="mt-1"><PaySource value={f.target} onChange={(v) => setF({ ...f, target: v })} testId="transfer-target" /></div></div>
          <div><Label>Shuma (€)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="transfer-amount" /></div>
          <div><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="transfer-date" /></div>
          <div className="col-span-2"><Label>Shënim</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="transfer-note" /></div>
        </div>
        <p className="text-[11px] text-slate-500">Arka → Bankë = depozitim (del nga arka). Bankë → Arka = tërheqje (hyn në arkë).</p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Anulo</Button>
          <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="transfer-save">Ruaj</Button></div>
      </DialogContent>
    </Dialog>
  );
};

const OpeningDialog = ({ open, banks, onClose, onSaved }) => {
  const [vals, setVals] = useState(() => Object.fromEntries(banks.map((b) => [b.bank, String(b.balance)])));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const changed = banks.filter((b) => vals[b.bank] !== "" && Number(vals[b.bank]) !== b.balance);
      for (const b of changed) await api.post("/banks/adjust", { bank: b.bank, balance: Number(vals[b.bank]) });
      toast.success(changed.length ? "Gjendja e bankave u përditësua" : "Asnjë ndryshim"); onClose(); onSaved();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gabim gjatë ruajtjes"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#141C2B] border-slate-800 text-slate-100" data-testid="opening-dialog">
        <DialogHeader><DialogTitle>Gjendja fillestare e bankave</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-400">Shkruaj sa para ke sot në secilën bankë. Sistemi shton një rresht korrigjimi me diferencën — Arka dhe Qarkullimet Ditore nuk ndryshojnë.</p>
        <div className="space-y-3">
          {banks.map((b) => {
            const d = vals[b.bank] === "" ? 0 : Math.round((Number(vals[b.bank]) - b.balance) * 100) / 100;
            return (
              <div key={b.bank} className="grid grid-cols-[90px_1fr_110px] items-center gap-3">
                <Label>{b.bank}</Label>
                <Input type="number" step="0.01" value={vals[b.bank]} onChange={(e) => setVals({ ...vals, [b.bank]: e.target.value })} className="bg-slate-900 border-slate-800" data-testid={`opening-input-${b.bank}`} />
                <span className={`text-xs font-mono-pd text-right ${d > 0 ? "text-emerald-500" : d < 0 ? "text-rose-500" : "text-slate-500"}`} data-testid={`opening-diff-${b.bank}`}>{d ? `${d > 0 ? "+" : ""}${eur(d)}` : "pa ndryshim"}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Anulo</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="opening-save">Ruaj</Button></div>
      </DialogContent>
    </Dialog>
  );
};

export default function BanksPage() {
  const [data, setData] = useState(null);
  const [bank, setBank] = useState(BANKS[0]);
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState({ date_from: "", date_to: "" });
  const [open, setOpen] = useState(false);
  const [openAdj, setOpenAdj] = useState(false);
  const load = useCallback(async () => {
    const [b, h] = await Promise.all([api.get("/banks"), api.get(`/banks/history/${bank}`, { params: range })]);
    setData(b.data); setRows(h.data);
  }, [bank, range]);
  useEffect(() => { load(); }, [load]);
  const delTransfer = async (id) => {
    if (!window.confirm("Ta fshij këtë transfertë?")) return;
    await api.delete(`/banks/transfers/${id}`); toast.success("U fshi"); load();
  };
  const delAdjust = async (id) => {
    if (!window.confirm("Ta fshij këtë korrigjim të gjendjes?")) return;
    await api.delete(`/banks/adjust/${id}`); toast.success("U fshi"); load();
  };

  return (
    <div className="p-4 md:p-8 pb-28 max-w-[1500px] mx-auto space-y-5" data-testid="banks-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Landmark className="w-8 h-8 text-sky-600" />
          <div><h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Gjendja e Bankave</h1>
            <p className="text-sm text-slate-500 mt-1">Totali në banka: <b className="font-mono-pd" data-testid="banks-total">{data ? eur(data.total) : "…"}</b></p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpenAdj(true)} disabled={!data} className="font-semibold" data-testid="opening-open-btn"><Scale className="w-4 h-4 mr-1" /> Gjendja fillestare</Button>
          <Button onClick={() => setOpen(true)} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold" data-testid="transfer-open-btn"><ArrowLeftRight className="w-4 h-4 mr-1" /> Depozitim / Tërheqje</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(data?.banks || []).map((b) => (
          <button key={b.bank} onClick={() => setBank(b.bank)} data-testid={`bank-card-${b.bank}`}
            className={`stat-card p-4 text-left transition-colors ${bank === b.bank ? "ring-2 ring-sky-500" : "hover:ring-1 hover:ring-slate-300"}`}>
            <div className="text-[10px] uppercase tracking-widest font-mono-pd text-slate-500">{b.bank}</div>
            <div className={`text-2xl font-extrabold font-mono-pd mt-1 ${b.balance < 0 ? "text-rose-600" : "text-slate-900"}`} data-testid={`bank-balance-${b.bank}`}>{eur(b.balance)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Hyrje {eur(b.in)} · Dalje {eur(b.out)}</div>
          </button>
        ))}
      </div>
      <div className="stat-card p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
          <h2 className="font-extrabold text-lg">Historiku · {bank}</h2>
          <div className="flex items-center gap-2 text-sm">
            Nga <Input type="date" value={range.date_from} onChange={(e) => setRange({ ...range, date_from: e.target.value })} className="w-40 bg-slate-900 border-slate-800" data-testid="bank-history-from" />
            deri <Input type="date" value={range.date_to} onChange={(e) => setRange({ ...range, date_to: e.target.value })} className="w-40 bg-slate-900 border-slate-800" data-testid="bank-history-to" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="bank-history-table">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
              <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Lloji</th><th className="px-3 py-2">Dok.</th><th className="px-3 py-2">Përshkrimi</th>
                <th className="px-3 py-2 text-right">Hyrje</th><th className="px-3 py-2 text-right">Dalje</th><th className="px-3 py-2 text-right">Gjendja</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={i} className="border-b border-slate-800/50" data-testid={`bank-row-${i}`}>
                  <td className="px-3 py-2 font-mono-pd whitespace-nowrap">{m.date.split("-").reverse().join(".")}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.type}</td><td className="px-3 py-2 font-mono-pd">{m.doc || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{m.description}</td>
                  <td className="px-3 py-2 text-right font-mono-pd text-emerald-600 whitespace-nowrap">{m.in ? eur(m.in) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono-pd text-rose-600 whitespace-nowrap">{m.out ? eur(m.out) : ""}</td>
                  <td className="px-3 py-2 text-right font-mono-pd font-semibold whitespace-nowrap">{eur(m.balance)}</td>
                  <td className="px-2">{m.transfer_id && <button onClick={() => delTransfer(m.transfer_id)} className="text-slate-400 hover:text-rose-600" data-testid={`bank-transfer-delete-${i}`}><Trash2 className="w-4 h-4" /></button>}
                    {m.adjust_id && <button onClick={() => delAdjust(m.adjust_id)} className="text-slate-400 hover:text-rose-600" data-testid={`bank-adjust-delete-${i}`}><Trash2 className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Asnjë lëvizje për {bank}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {data && openAdj && <OpeningDialog open={openAdj} banks={data.banks} onClose={() => setOpenAdj(false)} onSaved={load} />}
      <TransferDialog key={String(open)} open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}
