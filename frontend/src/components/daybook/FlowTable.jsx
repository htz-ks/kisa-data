import { useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Pencil, History, Trash2, Plus, Minus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { TYPE_STYLE } from "./util";
import { ManualDialog } from "./ManualDialog";
import { EntryEditDialog } from "./EntryEditDialog";
import { AuditDialog } from "./AuditDialog";

const Row = ({ e, onEdit, onHistory, onDelete }) => (
  <tr className="border-b border-slate-800/50" data-testid={`flow-row-${e.key}`}>
    <td className="px-3 py-2 font-mono-pd whitespace-nowrap">{e.date.split("-").reverse().join(".")}</td>
    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TYPE_STYLE[e.type] || ""}`}>{e.type}</span></td>
    <td className="px-3 py-2 min-w-[200px]">
      {e.description}
      {e.note && <span className="ml-2 text-[11px] text-amber-600">{e.note}</span>}
      {e.corrected && <span className="ml-2 text-[11px] text-sky-600 font-semibold">korrigjuar</span>}
    </td>
    <td className="px-3 py-2 font-mono-pd whitespace-nowrap">{e.invoice_no || "—"}</td>
    <td className="px-3 py-2 text-right font-mono-pd text-emerald-600 whitespace-nowrap">{e.hyrje ? eur(e.hyrje) : ""}</td>
    <td className="px-3 py-2 text-right font-mono-pd text-rose-600 whitespace-nowrap">{e.dalje ? eur(e.dalje) : ""}</td>
    <td className="px-3 py-2">{e.method === "bank" ? "Bankë" : "Cash"}</td>
    <td className={`px-3 py-2 text-right font-mono-pd font-semibold whitespace-nowrap ${e.profit > 0 ? "text-emerald-600" : e.profit < 0 ? "text-rose-600" : "text-slate-400"}`}>
      {e.cost_missing ? <span className="inline-flex items-center gap-1 text-amber-600" title="Mungon çmimi i blerjes"><AlertTriangle className="w-3.5 h-3.5" /> i paplotë</span> : e.profit ? eur(e.profit) : "—"}
    </td>
    <td className="px-2 py-2 whitespace-nowrap text-right">
      {e.source !== "service" && <button onClick={() => onEdit(e)} className="p-1.5 text-slate-500 hover:text-emerald-600" title="Korrigjo" data-testid={`flow-edit-${e.key}`}><Pencil className="w-4 h-4" /></button>}
      {e.source !== "service" && <button onClick={() => onHistory(e.key)} className="p-1.5 text-slate-500 hover:text-sky-600" title="Historiku" data-testid={`flow-history-${e.key}`}><History className="w-4 h-4" /></button>}
      {e.source === "manual" && <button onClick={() => onDelete(e)} className="p-1.5 text-slate-500 hover:text-rose-600" title="Fshi" data-testid={`flow-delete-${e.key}`}><Trash2 className="w-4 h-4" /></button>}
    </td>
  </tr>
);

export const FlowTable = ({ date, entries, summary, onChange }) => {
  const [manual, setManual] = useState(null); // {kind, entry}
  const [editKey, setEditKey] = useState(null);
  const [auditKey, setAuditKey] = useState(null);
  const onEdit = (e) => (e.source === "manual" ? setManual({ kind: e.kind, entry: e }) : setEditKey(e.key));
  const onDelete = async (e) => {
    const reason = window.prompt("Arsyeja e fshirjes (ruhet në historik):");
    if (!reason) return;
    try { await api.delete(`/daybook/manual/${e.source_id}`, { data: { reason } }); toast.success("U fshi"); onChange(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  return (
    <div className="stat-card p-0 overflow-hidden" data-testid="flow-table">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
        <h2 className="font-extrabold text-lg">Qarkullimet Ditore</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setManual({ kind: "in" })} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="flow-add-in-btn"><Plus className="w-4 h-4 mr-1" /> Hyrje</Button>
          <Button size="sm" onClick={() => setManual({ kind: "out" })} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold" data-testid="flow-add-out-btn"><Minus className="w-4 h-4 mr-1" /> Dalje</Button>
          <Button size="sm" variant="outline" onClick={() => setAuditKey("")} data-testid="flow-audit-all-btn"><History className="w-4 h-4 mr-1" /> Historiku</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-3 py-2">Data</th><th className="px-3 py-2">Lloji</th><th className="px-3 py-2">Produkti/Përshkrimi</th>
              <th className="px-3 py-2">Nr. faturës</th><th className="px-3 py-2 text-right">Hyrje (€)</th><th className="px-3 py-2 text-right">Dalje (€)</th>
              <th className="px-3 py-2">Pagesa</th><th className="px-3 py-2 text-right">Fitim/Humbje (€)</th><th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => <Row key={e.key} e={e} onEdit={onEdit} onHistory={setAuditKey} onDelete={onDelete} />)}
            {entries.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Asnjë transaksion për këtë ditë.</td></tr>}
          </tbody>
          {entries.length > 0 && (
            <tfoot className="font-bold border-t-2 border-slate-700">
              <tr>
                <td colSpan={4} className="px-3 py-2">Totali i ditës</td>
                <td className="px-3 py-2 text-right font-mono-pd text-emerald-600 whitespace-nowrap" data-testid="flow-total-in">{eur(entries.reduce((s, e) => s + e.hyrje, 0))}</td>
                <td className="px-3 py-2 text-right font-mono-pd text-rose-600 whitespace-nowrap" data-testid="flow-total-out">{eur(entries.reduce((s, e) => s + e.dalje, 0))}</td>
                <td />
                <td className={`px-3 py-2 text-right font-mono-pd whitespace-nowrap ${summary.net_profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{eur(summary.net_profit)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <ManualDialog open={!!manual} date={date} kind={manual?.kind} entry={manual?.entry} onClose={() => setManual(null)} onSaved={onChange} />
      <EntryEditDialog entryKey={editKey} onClose={() => setEditKey(null)} onSaved={onChange} />
      <AuditDialog auditKey={auditKey} onClose={() => setAuditKey(null)} />
    </div>
  );
};
