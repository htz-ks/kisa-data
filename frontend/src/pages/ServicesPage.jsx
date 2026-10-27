import { useCallback, useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, History, Printer, Trash2, Wrench, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { openPdf, waPhone } from "@/components/DebtLedger";
import { ServiceFormDialog } from "@/components/service/ServiceFormDialog";
import { DeliverDialog, ServiceHistoryDialog, STATUSES, statusOf } from "@/components/service/ServiceDialogs";

const inp = "bg-slate-900 border-slate-800";
const fmtDate = (d) => (d ? d.split("-").reverse().join(".") : "—");
// opens WhatsApp with a ready-made "your phone is ready" message for the customer
const notifyReady = (s) => {
  const lines = [
    `Përshëndetje ${s.first_name}${s.last_name ? " " + s.last_name : ""},`,
    `Telefoni juaj ${s.device} (servisi ${s.number}) është gati për t'u marrë.`,
    s.price != null ? `Çmimi i riparimit: ${Number(s.price).toFixed(2)} €.` : "",
    "HIGH TECH ZONE SH.P.K. · Rr. Henri Dunan nr. 6 · 044 104 605",
  ].filter(Boolean);
  window.open(`https://wa.me/${waPhone(s.phone)}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
};

export default function ServicesPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ q: "", status: "all", date_from: "", date_to: "" });
  const [form, setForm] = useState(null); // {service|null}
  const [deliver, setDeliver] = useState(null);
  const [refund, setRefund] = useState(null);
  const [history, setHistory] = useState(null);

  const load = useCallback(() => {
    const params = { ...filters, status: filters.status === "all" ? "" : filters.status };
    return api.get("/services", { params }).then(({ data }) => setRows(data));
  }, [filters]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setStatus = async (s, status, paid_amount, paid_method) => {
    try { await api.patch(`/services/${s.id}/status`, { status, paid_amount, paid_method }); toast.success(`Statusi: ${statusOf(status).l}`); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const onStatus = async (s, v) => {
    if (v === "delivered") return setDeliver(s);
    if (v === "refunded") {
      if (!["delivered", "refunded"].includes(s.status) || !(s.paid_amount > 0)) return toast.error("Kthimi i pagesës bëhet vetëm për servis të dorëzuar dhe të paguar");
      return setRefund(s);
    }
    await setStatus(s, v);
    if (v === "repaired" && window.confirm("Telefoni është gati. Ta njoftoj klientin në WhatsApp?")) notifyReady(s);
  };
  const remove = async (s) => {
    if (!window.confirm(`Je i sigurt që do ta fshish servisin ${s.number} (${s.device})?`)) return;
    await api.delete(`/services/${s.id}`); toast.success("U fshi"); load();
  };
  const onSaved = (data, isNew, partsOnly) => { load(); if (partsOnly) return; if (isNew && window.confirm("Ta printoj fletëpranimin për klientin?")) openPdf(`/services/${data.id}/receipt.pdf`); };
  const f = (p) => setFilters((x) => ({ ...x, ...p }));

  return (
    <div className="p-4 md:p-8 pb-28 max-w-[1600px] mx-auto space-y-5" data-testid="services-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Servis / Shërbimi</h1>
            <p className="text-sm text-slate-500 mt-1">Telefonat e pranuar për riparim · {rows.length} regjistrime</p>
          </div>
        </div>
        <Button onClick={() => setForm({ service: null })} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="service-new-btn">
          <Plus className="w-4 h-4 mr-1" /> Servis i ri
        </Button>
      </div>

      <div className="stat-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={filters.q} onChange={(e) => f({ q: e.target.value })} placeholder="Kërko klientin, telefonin, markën ose modelin" className={`${inp} pl-9`} data-testid="service-search-input" />
        </div>
        <Select value={filters.status} onValueChange={(v) => f({ status: v })}>
          <SelectTrigger className={`${inp} w-48`} data-testid="service-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Të gjitha statuset</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm">
          Nga <Input type="date" value={filters.date_from} onChange={(e) => f({ date_from: e.target.value })} className={`${inp} w-40`} data-testid="service-date-from" />
          deri <Input type="date" value={filters.date_to} onChange={(e) => f({ date_to: e.target.value })} className={`${inp} w-40`} data-testid="service-date-to" />
        </div>
        {(filters.q || filters.status !== "all" || filters.date_from || filters.date_to) && (
          <Button variant="outline" size="sm" onClick={() => setFilters({ q: "", status: "all", date_from: "", date_to: "" })} data-testid="service-clear-filters">Pastro</Button>
        )}
      </div>

      <div className="stat-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="services-table">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
              <tr>
                <th className="px-3 py-3">Nr.</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Klienti</th><th className="px-3 py-3">Telefoni</th>
                <th className="px-3 py-3">Pajisja</th><th className="px-3 py-3">Defekti</th><th className="px-3 py-3 text-right">Çmimi</th>
                <th className="px-3 py-3">Statusi</th><th className="px-3 py-3 text-right">Paguar</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 align-top" data-testid={`service-row-${s.id}`}>
                  <td className="px-3 py-2 font-mono-pd font-semibold">{s.number}</td>
                  <td className="px-3 py-2 font-mono-pd whitespace-nowrap">{fmtDate(s.received_date)}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{s.first_name} {s.last_name}</td>
                  <td className="px-3 py-2 font-mono-pd whitespace-nowrap">{s.phone}</td>
                  <td className="px-3 py-2">{s.device}</td>
                  <td className="px-3 py-2 min-w-[180px] text-slate-600">{s.defect}
                    {s.parts?.length > 0 && <div className="text-[11px] text-emerald-700 mt-0.5" data-testid={`service-parts-summary-${s.id}`}>Pjesë: {s.parts.map((p) => `${p.name} × ${p.quantity}`).join(", ")}</div>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-pd whitespace-nowrap">{s.price != null ? eur(s.price) : "—"}</td>
                  <td className="px-3 py-2">
                    <Select value={s.status} onValueChange={(v) => onStatus(s, v)}>
                      <SelectTrigger className={`h-8 w-44 border-0 font-semibold text-xs ${statusOf(s.status).c}`} data-testid={`service-status-${s.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-pd whitespace-nowrap text-emerald-600" data-testid={`service-paid-${s.id}`}>
                    {["delivered", "refunded"].includes(s.status) ? <>{eur(s.paid_amount || 0)}<div className="text-[10px] text-slate-500">{s.paid_method === "bank" ? "Bankë" : "Cash"} · {fmtDate(s.delivered_date)}</div></> : "—"}
                    {s.status === "refunded" && <div className="text-amber-600 text-xs mt-1" data-testid={`service-refund-${s.id}`}>Kthyer −{eur(s.refund_amount || 0)}<div className="text-[10px] text-slate-500">{s.refund_method === "bank" ? "Bankë" : "Cash"} · {fmtDate(s.refund_date)}</div></div>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-right">
                    <button onClick={() => setForm({ service: s })} className="p-1.5 text-slate-500 hover:text-emerald-600" title="Ndrysho" data-testid={`service-edit-${s.id}`}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setHistory(s)} className="p-1.5 text-slate-500 hover:text-sky-600" title="Historiku" data-testid={`service-history-${s.id}`}><History className="w-4 h-4" /></button>
                    <button onClick={() => notifyReady(s)} className={`p-1.5 hover:text-green-600 ${s.status === "repaired" ? "text-green-600" : "text-slate-500"}`} title="Njofto klientin në WhatsApp që telefoni është gati" data-testid={`service-whatsapp-${s.id}`}><MessageCircle className="w-4 h-4" /></button>
                    <button onClick={() => openPdf(`/services/${s.id}/receipt.pdf`)} className="p-1.5 text-slate-500 hover:text-slate-900" title="Fletëpranimi A4" data-testid={`service-print-${s.id}`}><Printer className="w-4 h-4" /></button>
                    <button onClick={() => remove(s)} className="p-1.5 text-slate-500 hover:text-rose-600" title="Fshi" data-testid={`service-delete-${s.id}`}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Asnjë servis.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <ServiceFormDialog open={!!form} service={form?.service} onClose={() => setForm(null)} onSaved={onSaved} />
      <DeliverDialog service={deliver} onClose={() => setDeliver(null)} onConfirm={(amt, m) => { const s = deliver; setDeliver(null); setStatus(s, "delivered", amt, m); }} />
      <DeliverDialog refund service={refund} onClose={() => setRefund(null)} onConfirm={(amt, m) => { const s = refund; setRefund(null); setStatus(s, "refunded", amt, m); }} />
      <ServiceHistoryDialog service={history} onClose={() => setHistory(null)} />
    </div>
  );
}
