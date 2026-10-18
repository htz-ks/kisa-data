import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Undo2 } from "lucide-react";

export default function ReturnsPage() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/returns").then(({ data }) => setList(data)); }, []);

  const total = list.reduce((s, r) => s + (r.refund_total || 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Rikthimet" subtitle="Historia e produkteve të kthyera dhe pagesave të kundërta" />

      <div className="stat-card mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Undo2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-mono-pd">Totali i rikthimeve</div>
            <div className="text-2xl font-extrabold text-amber-400">{eur(total)}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 font-mono-pd uppercase tracking-widest">Numri</div>
          <div className="text-2xl font-extrabold">{list.length}</div>
        </div>
      </div>

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Fatura</th>
              <th className="px-4 py-3">Klienti</th>
              <th className="px-4 py-3">Artikuj</th>
              <th className="px-4 py-3">Arsyeja</th>
              <th className="px-4 py-3 text-right">Zbr. borxhi</th>
              <th className="px-4 py-3 text-right">Cash kthyer</th>
              <th className="px-4 py-3 text-right">Totali</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`return-row-${r.id}`}>
                <td className="px-4 py-3 font-mono-pd text-xs text-slate-400">{(r.created_at || "").slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3 font-mono-pd text-emerald-400">{r.invoice_no}</td>
                <td className="px-4 py-3">{r.customer_name || "Klient i rastit"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(r.items || []).map((it, i) => (
                      <Badge key={i} variant="outline" className="border-slate-700 text-slate-300 font-normal">
                        {it.product_name} × {it.quantity}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{r.reason || "—"}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-emerald-400">{eur(r.debt_reduction)}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-sky-400">{eur(r.cash_refund)}</td>
                <td className="px-4 py-3 text-right font-mono-pd font-bold text-amber-400">{eur(r.refund_total)}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Pa rikthime.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
