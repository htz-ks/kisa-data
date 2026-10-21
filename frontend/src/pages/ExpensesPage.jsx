import { useEffect, useMemo, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["Qiraja", "Rryma", "Uji", "Interneti", "Paga", "Transporti", "Furnizime zyre", "Servisi", "Taksat", "Tjetër"];
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { category: "Tjetër", description: "", amount: "", date: today() };

const ExpenseForm = ({ onSaved }) => {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!(Number(f.amount) > 0)) { toast.error("Shkruaj shumën e shpenzimit"); return; }
    setSaving(true);
    try {
      await api.post("/expenses", { ...f, amount: Number(f.amount) });
      toast.success(`Shpenzimi ${eur(Number(f.amount))} u regjistrua`);
      setF({ ...EMPTY, date: f.date });
      await onSaved();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };
  const inp = "mt-1 bg-slate-900 border-slate-800";
  return (
    <div className="stat-card mb-6 grid grid-cols-1 md:grid-cols-12 gap-3 items-end" data-testid="expense-form">
      <div className="md:col-span-2">
        <Label>Data</Label>
        <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inp} data-testid="expense-date-input" />
      </div>
      <div className="md:col-span-3">
        <Label>Lloji i shpenzimit</Label>
        <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
          <SelectTrigger className={inp} data-testid="expense-category-select"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="md:col-span-4">
        <Label>Përshkrimi</Label>
        <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="p.sh. Fatura e rrymës për tetor"
          onKeyDown={(e) => e.key === "Enter" && save()} className={inp} data-testid="expense-description-input" />
      </div>
      <div className="md:col-span-2">
        <Label>Shuma (€)</Label>
        <Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && save()} autoFocus className={inp + " font-mono-pd"} data-testid="expense-amount-input" />
      </div>
      <div className="md:col-span-1">
        <Button onClick={save} disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="expense-save-btn">
          <Plus className="w-4 h-4" /> Ruaj
        </Button>
      </div>
    </div>
  );
};

export default function ExpensesPage() {
  const [list, setList] = useState([]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const load = async () => { const { data } = await api.get("/expenses"); setList(data); };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => list.filter((e) => !month || (e.date || "").startsWith(month)), [list, month]);
  const total = shown.reduce((s, e) => s + (e.amount || 0), 0);

  const remove = async (e) => {
    if (!window.confirm(`Ta fshish shpenzimin ${eur(e.amount)}?`)) return;
    await api.delete(`/expenses/${e.id}`);
    toast.success("Shpenzimi u fshi");
    await load();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Shpenzimet" subtitle="Evidento çdo shpenzim të biznesit" />
      <ExpenseForm onSaved={load} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Label className="text-slate-400">Muaji</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44 bg-slate-900 border-slate-800" data-testid="expense-month-filter" />
          <Button variant="outline" size="sm" onClick={() => setMonth("")} data-testid="expense-all-btn">Të gjitha</Button>
        </div>
        <div className="flex items-center gap-2 text-lg font-bold" data-testid="expense-total">
          <Banknote className="w-5 h-5 text-rose-400" /> Totali: <span className="text-rose-400 font-mono-pd">{eur(total)}</span>
        </div>
      </div>

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Lloji</th><th className="px-4 py-3">Përshkrimi</th><th className="px-4 py-3">Regjistroi</th><th className="px-4 py-3 text-right">Shuma</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/50" data-testid={`expense-row-${e.id}`}>
                <td className="px-4 py-3 font-mono-pd text-xs text-slate-400">{e.date}</td>
                <td className="px-4 py-3">{e.category}</td>
                <td className="px-4 py-3 text-slate-300">{e.description || "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{e.created_by_name || "—"}</td>
                <td className="px-4 py-3 text-right font-mono-pd font-semibold text-rose-400">{eur(e.amount)}</td>
                <td className="px-2 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => remove(e)} className="h-8 w-8 text-red-400 hover:bg-red-500/10" data-testid={`expense-delete-${e.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Asnjë shpenzim për këtë periudhë.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
