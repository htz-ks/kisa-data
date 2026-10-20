import { Button } from "@/components/ui/button";
import { eur, API } from "@/lib/api";
import { FileText, MessageCircle, History } from "lucide-react";

const waLink = (customer, ledger) => {
  const phone = (customer.phone || "").replace(/[^0-9]/g, "");
  const lines = ledger.slice(-10).map((r) => {
    const d = (r.date || "").slice(0, 10);
    const what = r.kind === "payment" ? `Pagesë -€ ${r.paid.toFixed(2)}` : r.kind === "sale" ? `${r.doc} +€ ${r.debt.toFixed(2)}` : `${r.doc} € ${r.debt.toFixed(2)}`;
    return `${d} ${what} → € ${r.balance.toFixed(2)}`;
  });
  const msg = `Përshëndetje ${customer.name}!\n\nHistoria e borxhit:\n${lines.join("\n")}\n\nBorxhi aktual: € ${(customer.balance || 0).toFixed(2)}\n\nFaleminderit - Kisa-Data`;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
};

export const DebtLedger = ({ customer, ledger }) => (
  <div data-testid="debt-ledger">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4" /> Historia e borxhit</h4>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild data-testid="debt-whatsapp-btn">
          <a href={waLink(customer, ledger)} target="_blank" rel="noreferrer">
            <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-400" /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" data-testid="debt-pdf-btn"
          onClick={() => window.open(`${API}/customers/${customer.id}/statement.pdf`, "_blank")}>
          <FileText className="w-3.5 h-3.5 mr-1 text-sky-400" /> PDF A4
        </Button>
      </div>
    </div>
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60 text-slate-500 uppercase font-mono-pd">
          <tr><th className="px-2 py-2 text-left">Data</th><th className="px-2 py-2 text-left">Dokumenti</th><th className="px-2 py-2 text-right">+/-</th><th className="px-2 py-2 text-right">Gjendja</th></tr>
        </thead>
        <tbody>
          {ledger.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500">Pa lëvizje borxhi.</td></tr>}
          {ledger.map((r, i) => (
            <tr key={i} className="border-t border-slate-800/60" data-testid={`ledger-row-${i}`}>
              <td className="px-2 py-1.5 font-mono-pd text-slate-400">{(r.date || "").slice(0, 10) || "—"}</td>
              <td className="px-2 py-1.5">{r.doc}{r.kind === "sale" && <span className="text-slate-500"> · totali {eur(r.total)}</span>}</td>
              <td className={`px-2 py-1.5 text-right font-mono-pd ${r.debt < 0 ? "text-emerald-400" : "text-amber-400"}`}>{r.debt < 0 ? "−" : "+"}{eur(Math.abs(r.debt))}</td>
              <td className="px-2 py-1.5 text-right font-mono-pd font-semibold">{eur(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
