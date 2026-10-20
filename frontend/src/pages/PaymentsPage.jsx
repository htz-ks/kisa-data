import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const DebtRow = ({ c, type, onPaid }) => {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const debt = c.balance || 0;
  const paid = Number(amount) || 0;
  const remaining = Math.max(0, debt - paid);

  const pay = async () => {
    if (paid <= 0) { toast.error("Shkruaj shumën e pagesës"); return; }
    if (paid > debt + 0.001) { toast.error(`Pagesa s'mund të jetë më e madhe se borxhi (${eur(debt)})`); return; }
    setSaving(true);
    try {
      await api.post("/payments", {
        entity_type: type, entity_id: c.id, amount: paid,
        direction: type === "customer" ? "in" : "out", notes: "",
      });
      toast.success(`${c.name}: u pagua ${eur(paid)}, mbetet ${eur(remaining)}`);
      setAmount("");
      await onPaid();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-slate-800/50" data-testid={`debt-row-${c.id}`}>
      <td className="px-4 py-3 font-medium">{c.name}</td>
      <td className="px-4 py-3 text-slate-400">{c.phone || "—"}</td>
      <td className="px-4 py-3 text-right font-mono-pd font-semibold text-amber-400" data-testid={`debt-balance-${c.id}`}>{eur(debt)}</td>
      <td className="px-4 py-2 text-right">
        <Input type="number" step="0.01" min="0" value={amount} placeholder="0.00"
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pay()}
          className="h-9 w-32 ml-auto text-right bg-slate-900 border-slate-700 font-mono-pd" data-testid={`debt-pay-input-${c.id}`} />
      </td>
      <td className={`px-4 py-3 text-right font-mono-pd font-bold ${remaining === 0 && paid > 0 ? "text-emerald-400" : "text-slate-100"}`}
        data-testid={`debt-remaining-${c.id}`}>{eur(remaining)}</td>
      <td className="px-4 py-2 text-right">
        <Button size="sm" disabled={saving || paid <= 0} onClick={pay}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid={`debt-pay-btn-${c.id}`}>
          Paguaj
        </Button>
      </td>
    </tr>
  );
};

const DebtTable = ({ list, type, onPaid }) => {
  const debtors = list.filter((c) => (c.balance || 0) > 0.001).sort((a, b) => b.balance - a.balance);
  return (
    <div className="data-grid bg-[#0D131E] mb-8">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
          <tr>
            <th className="px-4 py-3">{type === "customer" ? "Klienti" : "Furnitori"}</th>
            <th className="px-4 py-3">Telefoni</th>
            <th className="px-4 py-3 text-right">Borxhi</th>
            <th className="px-4 py-3 text-right">Pagesa</th>
            <th className="px-4 py-3 text-right">Mbetet</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {debtors.map((c) => <DebtRow key={c.id} c={c} type={type} onPaid={onPaid} />)}
          {debtors.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">
              {type === "customer" ? "Asnjë klient me borxh." : "Asnjë borxh te furnitorët."}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [tab, setTab] = useState("customer");

  const load = async () => {
    const [p, c, s] = await Promise.all([api.get("/payments"), api.get("/customers"), api.get("/suppliers")]);
    setPayments(p.data); setCustomers(c.data); setSuppliers(s.data);
  };
  useEffect(() => { load(); }, []);

  const nameFor = (p) => {
    const arr = p.entity_type === "customer" ? customers : suppliers;
    return arr.find((x) => x.id === p.entity_id)?.name || "—";
  };
  const sum = (arr) => arr.reduce((s, c) => s + Math.max(0, c.balance || 0), 0);
  const tabBtn = (key, label, total, color) => (
    <button onClick={() => setTab(key)} data-testid={`debt-tab-${key}`}
      className={`stat-card text-left transition-colors ${tab === key ? "ring-2 ring-emerald-500" : "opacity-80 hover:opacity-100"}`}>
      <div className="text-xs uppercase font-mono-pd text-slate-500 tracking-widest">{label}</div>
      <div className={`text-2xl font-extrabold mt-2 ${color}`}>{eur(total)}</div>
    </button>
  );

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Pagesa & Borxhe" subtitle="Shkruaj sa paguan dhe borxhi i mbetur llogaritet vetë" />

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {tabBtn("customer", "Borxh klientësh", sum(customers), "text-amber-400")}
        {tabBtn("supplier", "Borxh furnitorësh", sum(suppliers), "text-red-400")}
      </div>

      <DebtTable list={tab === "customer" ? customers : suppliers} type={tab} onPaid={load} />

      <h3 className="text-sm uppercase tracking-widest font-mono-pd text-slate-500 mb-3">Historiku i pagesave</h3>
      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Lloji</th><th className="px-4 py-3">Kujt</th><th className="px-4 py-3 text-right">Borxhi para</th><th className="px-4 py-3 text-right">Pagesa</th><th className="px-4 py-3 text-right">Mbeti</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50" data-testid={`payment-row-${p.id}`}>
                <td className="px-4 py-3 font-mono-pd text-xs text-slate-400">{(p.created_at || "").slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3">{p.entity_type === "customer" ? "Klient" : "Furnitor"}</td>
                <td className="px-4 py-3">{nameFor(p)}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-slate-400">{p.balance_before != null ? eur(p.balance_before) : "—"}</td>
                <td className="px-4 py-3 text-right font-mono-pd font-semibold text-emerald-400">{eur(p.amount)}</td>
                <td className="px-4 py-3 text-right font-mono-pd">{p.balance_after != null ? eur(p.balance_after) : "—"}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Pa pagesa.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
