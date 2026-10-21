import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Moon, Trash2, HandCoins, Plus } from "lucide-react";

const err = (e, fb) => toast.error(formatApiErrorDetail(e.response?.data?.detail) || fb);
const inp = "mt-1 bg-white border-slate-300 text-slate-900";

const ZakatYear = ({ z, onChange }) => {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const pay = async () => {
    if (!(Number(amount) > 0)) return toast.error("Shkruaj shumën");
    try {
      await api.post(`/zakat/${z.id}/payments`, { amount: Number(amount), notes });
      toast.success(`U pagua ${eur(Number(amount))} Zekat`); setAmount(""); setNotes(""); onChange();
    } catch (e) { err(e, "Pagesa dështoi"); }
  };
  const delPay = async (p) => {
    if (!window.confirm(`Fshi pagesën ${eur(p.amount)}?`)) return;
    await api.delete(`/zakat/payments/${p.id}`); onChange();
  };
  const delYear = async () => {
    if (!window.confirm(`Fshi Zekatin e vitit ${z.year} bashkë me pagesat?`)) return;
    await api.delete(`/zakat/${z.id}`); onChange();
  };
  return (
    <div className="border border-slate-200 rounded-xl bg-white p-4" data-testid={`zakat-year-${z.year}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-extrabold text-slate-900">Viti {z.year}</div>
        <div className="flex gap-5 text-sm">
          <div>Zekati: <b className="font-mono-pd">{eur(z.amount)}</b></div>
          <div>Paguar: <b className="font-mono-pd text-emerald-600" data-testid={`zakat-paid-${z.year}`}>{eur(z.paid)}</b></div>
          <div>Mbetur: <b className={`font-mono-pd ${z.remaining > 0.004 ? "text-amber-600" : "text-emerald-600"}`} data-testid={`zakat-remaining-${z.year}`}>{eur(z.remaining)}</b></div>
          <button onClick={delYear} className="text-red-500" title="Fshi vitin" data-testid={`zakat-delete-${z.year}`}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="text-xs text-slate-500 mt-1">Vlera e stokut {eur(z.stock_cost)} + fitim simbolik {z.margin_pct}% → 2.5%</div>
      {z.remaining > 0.004 && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Shuma (€)" className="w-36 bg-white border-slate-300 text-slate-900" data-testid={`zakat-pay-amount-${z.year}`} />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shënim (kujt iu dha)" className="flex-1 min-w-[160px] bg-white border-slate-300 text-slate-900" data-testid={`zakat-pay-notes-${z.year}`} />
          <Button onClick={pay} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold" data-testid={`zakat-pay-btn-${z.year}`}><HandCoins className="w-4 h-4 mr-1" /> Paguaj</Button>
        </div>
      )}
      {z.payments.length > 0 && (
        <table className="w-full text-sm mt-3">
          <thead className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-200">
            <tr><th className="py-1.5">Data</th><th>Shënim</th><th className="text-right">Paguar</th><th className="text-right">Mbetur pas</th><th /></tr>
          </thead>
          <tbody>
            {z.payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100" data-testid={`zakat-payment-${p.id}`}>
                <td className="py-1.5 font-mono-pd">{new Date(p.created_at).toLocaleDateString("sq-AL")}</td>
                <td className="text-slate-600">{p.notes || "—"}</td>
                <td className="text-right font-mono-pd text-emerald-600">{eur(p.amount)}</td>
                <td className="text-right font-mono-pd">{eur(p.remaining_after)}</td>
                <td className="text-right"><button onClick={() => delPay(p)} className="text-red-500" data-testid={`zakat-payment-delete-${p.id}`}><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export const ZakatSection = ({ stockCost }) => {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [margin, setMargin] = useState(10);
  const [amount, setAmount] = useState("");
  const load = () => api.get("/zakat").then(({ data }) => setYears(data));
  useEffect(() => { load(); }, []);

  const base = stockCost * (1 + (Number(margin) || 0) / 100);
  const calc = Math.round(base * 0.025 * 100) / 100;

  const create = async () => {
    const value = amount === "" ? calc : Number(amount);
    try {
      await api.post("/zakat", { year: Number(year), stock_cost: stockCost, margin_pct: Number(margin) || 0, amount: value });
      toast.success(`Zekati i vitit ${year}: ${eur(value)}`); setAmount(""); load();
    } catch (e) { err(e, "Nuk u krijua"); }
  };

  return (
    <div className="stat-card mt-8 p-5" data-testid="zakat-section">
      <div className="flex items-center gap-2 mb-1">
        <Moon className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-extrabold text-slate-900">Zekati (2.5%)</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Llogaritet nga vlera e blerjes së stokut + një fitim i vogël simbolik, sikur të shitej gjithë malli.</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div><Label className="text-slate-700">Viti</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inp} data-testid="zakat-year-input" /></div>
        <div><Label className="text-slate-700">Fitim simbolik %</Label><Input type="number" step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)} className={inp} data-testid="zakat-margin-input" /></div>
        <div><Label className="text-slate-700">Vlera e mallit</Label><div className="mt-1 h-9 flex items-center font-mono-pd font-bold text-slate-800" data-testid="zakat-base-value">{eur(base)}</div></div>
        <div><Label className="text-slate-700">Zekati (mund ta ndryshosh)</Label><Input type="number" step="0.01" value={amount} placeholder={calc.toFixed(2)} onChange={(e) => setAmount(e.target.value)} className={inp} data-testid="zakat-amount-input" /></div>
        <Button onClick={create} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" data-testid="zakat-create-btn"><Plus className="w-4 h-4 mr-1" /> Krijo Zekatin</Button>
      </div>
      <div className="space-y-3 mt-5">
        {years.map((z) => <ZakatYear key={z.id} z={z} onChange={load} />)}
        {years.length === 0 && <div className="text-sm text-slate-500 text-center py-4">Ende nuk ka Zekat të regjistruar.</div>}
      </div>
    </div>
  );
};
