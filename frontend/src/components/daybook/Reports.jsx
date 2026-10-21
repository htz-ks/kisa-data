import { useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, FileText, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { openPdf } from "@/components/DebtLedger";
import { download, inp, MONTHS } from "./util";

const COLS = [["sales_total", "Shitjet"], ["purchases_total", "Blerjet"], ["expenses_total", "Shpenzimet"], ["returns_total", "Kthimet"],
  ["cash_in", "Hyrje Cash"], ["cash_out", "Dalje Cash"], ["gross_profit", "Fitimi bruto"], ["net_profit", "Fitimi neto"],
  ["cash_end", "Arka në fund"], ["count_difference", "Dif. numërimit"]];
const period = (p) => (p.length === 10 ? p.split("-").reverse().join(".") : p.length === 7 ? `${MONTHS[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}` : p);
const color = (k, v) => (["net_profit", "gross_profit", "count_difference"].includes(k) && v ? (v > 0 ? "text-emerald-600" : "text-rose-600") : "");

export const Reports = ({ date }) => {
  const [f, setF] = useState({ date_from: `${date.slice(0, 8)}01`, date_to: date, group: "day" });
  const [data, setData] = useState(null);
  const q = new URLSearchParams(f).toString();
  const run = async () => {
    try { const { data: d } = await api.get(`/daybook/report?${q}`); setData(d); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const preset = (kind) => {
    const y = date.slice(0, 4);
    if (kind === "month") setF({ ...f, date_from: `${date.slice(0, 8)}01`, date_to: date, group: "day" });
    if (kind === "year") setF({ ...f, date_from: `${y}-01-01`, date_to: `${y}-12-31`, group: "month" });
  };
  return (
    <div className="stat-card p-4" data-testid="daybook-reports">
      <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-5 h-5 text-sky-600" /><h2 className="font-extrabold text-lg">Raportet</h2></div>
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Nga</Label><Input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} className={inp} data-testid="report-from" /></div>
        <div><Label>Deri</Label><Input type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} className={inp} data-testid="report-to" /></div>
        <div><Label>Grupimi</Label>
          <Select value={f.group} onValueChange={(v) => setF({ ...f, group: v })}>
            <SelectTrigger className={`${inp} w-32`} data-testid="report-group"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="day">Ditor</SelectItem><SelectItem value="month">Mujor</SelectItem><SelectItem value="year">Vjetor</SelectItem></SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => preset("month")} data-testid="report-preset-month">Ky muaj</Button>
        <Button variant="outline" size="sm" onClick={() => preset("year")} data-testid="report-preset-year">Ky vit</Button>
        <Button onClick={run} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold" data-testid="report-run">Shfaq raportin</Button>
        <Button variant="outline" onClick={() => download(`/daybook/report.xlsx?${q}`, `qarkullimet_${f.date_from}_${f.date_to}.xlsx`)} data-testid="report-excel"><FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-600" /> Excel</Button>
        <Button variant="outline" onClick={() => openPdf(`/daybook/report.pdf?${q}`)} data-testid="report-pdf"><FileText className="w-4 h-4 mr-1 text-rose-600" /> PDF</Button>
      </div>
      {data && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm" data-testid="report-table">
            <thead className="text-[11px] uppercase text-slate-500 border-b border-slate-800">
              <tr><th className="text-left px-2 py-2">Periudha</th>{COLS.map(([k, l]) => <th key={k} className="text-right px-2 py-2 whitespace-nowrap">{l}</th>)}</tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.period} className="border-b border-slate-800/40">
                  <td className="px-2 py-1.5 font-mono-pd whitespace-nowrap">{period(r.period)}{r.profit_incomplete && <span className="text-amber-600" title="Fitim i paplotë"> *</span>}</td>
                  {COLS.map(([k]) => <td key={k} className={`px-2 py-1.5 text-right font-mono-pd ${color(k, r[k])}`}>{r[k] == null ? "—" : eur(r[k])}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold border-t-2 border-slate-700">
              <tr><td className="px-2 py-2">TOTALI</td>{COLS.map(([k]) => <td key={k} className={`px-2 py-2 text-right font-mono-pd ${color(k, data.totals[k])}`} data-testid={`report-total-${k}`}>{data.totals[k] == null ? "—" : eur(data.totals[k])}</td>)}</tr>
            </tfoot>
          </table>
          {data.totals.profit_incomplete && <div className="text-xs text-amber-600 mt-2">* Fitimi është i paplotë: mungon çmimi i blerjes për disa produkte.</div>}
        </div>
      )}
    </div>
  );
};
