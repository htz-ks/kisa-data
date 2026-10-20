import { useEffect, useMemo, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { DebtActions } from "@/components/DebtLedger";
import { Search, CheckCircle2, AlertCircle } from "lucide-react";

const FILTERS = [
  { key: "all", label: "Të gjithë" },
  { key: "paid", label: "Paguar plotësisht" },
  { key: "debt", label: "Me borxh" },
];

const StatusBadge = ({ c }) => (c.balance > 0.004 ? (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400"><AlertCircle className="w-3.5 h-3.5" /> Borxh</span>
) : c.balance < -0.004 ? (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-500"><CheckCircle2 className="w-3.5 h-3.5" /> Paguar tepër (në favor të klientit)</span>
) : (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Paguar plotësisht</span>
));

export default function CustomerCardsPage() {
  const [cards, setCards] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => { api.get("/customer-cards").then(({ data }) => setCards(data)); }, []);

  const list = useMemo(() => cards.filter((c) => {
    const s = q.trim().toLowerCase();
    if (s && !c.name.toLowerCase().includes(s) && !(c.phone || "").includes(s)) return false;
    if (filter === "paid") return c.balance <= 0.004 && c.invoices > 0;
    if (filter === "debt") return c.balance > 0.004;
    return true;
  }), [cards, q, filter]);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Kartela e blerësve" subtitle="Pasqyra e klientëve · dërgo kartelën si foto në WhatsApp ose PDF A4" />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kërko klientin ose telefonin"
            className="pl-9 bg-slate-900 border-slate-800" data-testid="cards-search-input" />
        </div>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} data-testid={`cards-filter-${f.key}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f.key ? "bg-emerald-500 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Klienti</th><th className="px-4 py-3">Telefoni</th>
              <th className="px-4 py-3 text-right">Fatura</th><th className="px-4 py-3 text-right">Blerë</th>
              <th className="px-4 py-3 text-right">Paguar</th><th className="px-4 py-3 text-right">Borxhi</th>
              <th className="px-4 py-3">Statusi</th><th className="px-4 py-3 text-right">Dërgo kartelën</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/50" data-testid={`card-row-${c.id}`}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-slate-400 font-mono-pd">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-right font-mono-pd">{c.invoices}</td>
                <td className="px-4 py-3 text-right font-mono-pd">{eur(c.bought)}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-emerald-400">{eur(c.paid)}</td>
                <td className={`px-4 py-3 text-right font-mono-pd font-bold ${c.balance > 0.004 ? "text-amber-400" : "text-slate-300"}`} data-testid={`card-balance-${c.id}`}>{eur(c.balance)}</td>
                <td className="px-4 py-3"><StatusBadge c={c} /></td>
                <td className="px-4 py-2"><DebtActions compact customer={c} pdfPath={`/customers/${c.id}/statement.pdf`} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Asnjë klient.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
