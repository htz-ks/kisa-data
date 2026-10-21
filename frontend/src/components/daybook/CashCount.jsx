import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Save } from "lucide-react";
import { toast } from "sonner";
import { DENOMS, signed } from "./util";

const label = (d) => `${Number(d).toLocaleString("de-DE", { minimumFractionDigits: Number(d) < 1 ? 2 : 0 })} €`;

export const DiffBadge = ({ diff }) => {
  if (diff == null) return <span className="text-slate-400">—</span>;
  if (Math.abs(diff) < 0.005) return <span className="text-emerald-600 font-bold">Arka në rregull – Diferenca 0,00 €</span>;
  return diff < 0
    ? <span className="text-rose-600 font-bold">Mungesë në arkë: {signed(diff)}</span>
    : <span className="text-amber-600 font-bold">Tepricë në arkë: {signed(diff)}</span>;
};

export const CashCount = ({ date, count, expected, onSaved }) => {
  const [q, setQ] = useState({});
  const [note, setNote] = useState("");
  useEffect(() => { setQ(count?.counts || {}); setNote(count?.note || ""); }, [count, date]);
  const total = Math.round(DENOMS.reduce((s, d) => s + Number(d) * (Number(q[d]) || 0), 0) * 100) / 100;
  const diff = expected == null ? null : Math.round((total - expected) * 100) / 100;
  const save = async () => {
    try {
      await api.put(`/daybook/count/${date}`, { counts: Object.fromEntries(DENOMS.map((d) => [d, Number(q[d]) || 0])), note });
      toast.success("Numërimi u ruajt"); onSaved();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <div className="stat-card p-4" data-testid="cash-count">
      <div className="flex items-center gap-2 mb-3"><Coins className="w-5 h-5 text-amber-500" /><h2 className="font-extrabold text-lg">Numërimi i Parave</h2></div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase text-slate-500 border-b border-slate-800">
          <tr><th className="text-left py-1.5">Prerja</th><th className="text-center">Sasia</th><th className="text-right">Totali</th></tr>
        </thead>
        <tbody>
          {DENOMS.map((d) => (
            <tr key={d} className="border-b border-slate-800/40">
              <td className="py-1 font-mono-pd font-semibold">{label(d)}</td>
              <td className="py-1 text-center">
                <Input type="number" min="0" inputMode="numeric" value={q[d] ?? ""} placeholder="0"
                  onChange={(e) => setQ((x) => ({ ...x, [d]: e.target.value.replace(/[^0-9]/g, "") }))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const next = DENOMS[DENOMS.indexOf(d) + 1];
                    const el = document.querySelector(next ? `[data-testid="count-qty-${next}"]` : '[data-testid="count-save-btn"]');
                    el?.focus(); el?.select?.();
                  }}
                  className="h-8 w-24 mx-auto text-center bg-slate-900 border-slate-800" data-testid={`count-qty-${d}`} />
              </td>
              <td className="py-1 text-right font-mono-pd" data-testid={`count-line-${d}`}>{eur(Number(d) * (Number(q[d]) || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between font-extrabold text-base"><span>Totali i Parave të Numëruara</span><span className="font-mono-pd" data-testid="count-total">{eur(total)}</span></div>
        <div className="flex justify-between"><span>Gjendja e arkës sipas programit</span><span className="font-mono-pd">{expected == null ? "—" : eur(expected)}</span></div>
        <div className="pt-1" data-testid="count-difference"><DiffBadge diff={diff} /></div>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shënim (opsional)" className="mt-3 bg-slate-900 border-slate-800" data-testid="count-note" />
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-slate-500">{count?.updated_at ? `Ruajtur ${new Date(count.updated_at).toLocaleString("sq-AL")} · ${count.updated_by}` : "Ende pa numërim për këtë ditë"}</span>
        <Button onClick={save} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold" data-testid="count-save-btn"><Save className="w-4 h-4 mr-1" /> Ruaj numërimin</Button>
      </div>
      <div className="text-[11px] text-slate-500 mt-2">Numërimi nuk e ndryshon gjendjen kontabël të arkës; diferenca shfaqet veçmas.</div>
    </div>
  );
};
