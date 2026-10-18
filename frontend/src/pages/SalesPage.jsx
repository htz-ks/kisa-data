import { useEffect, useState } from "react";
import api, { eur, API } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, MessageCircle, Undo2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import PrintMenu from "@/components/PrintMenu";
import ReturnDialog from "@/components/ReturnDialog";
import { useAuth } from "@/context/AuthContext";

function waLinkFor(sale, customers) {
  const cust = customers.find((c) => c.id === sale.customer_id);
  const phone = (cust?.phone || "").replace(/[^0-9+]/g, "");
  const msg = encodeURIComponent(
    `Përshëndetje${cust ? " " + cust.name : ""}!\n\nFatura: ${sale.invoice_no}\nTotali: € ${(sale.total || 0).toFixed(2)}\nBorxh: € ${(sale.due_amount || 0).toFixed(2)}\n\nFaleminderit - Prodata Shop`
  );
  return phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
}

export default function SalesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [view, setView] = useState(null);
  const [returnFor, setReturnFor] = useState(null);
  const load = () => { api.get("/sales").then(({ data }) => setSales(data)); };
  useEffect(() => {
    load();
    api.get("/customers").then(({ data }) => setCustomers(data));
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Faturat / Shitjet" subtitle="Historiku i të gjitha shitjeve" />
      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Nr. Faturës</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Klienti</th>
              <th className="px-4 py-3">Pagesa</th>
              <th className="px-4 py-3 text-right">Totali</th>
              <th className="px-4 py-3 text-right">Borxh</th>
              <th className="px-4 py-3 text-right">Veprime</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`sale-row-${s.id}`}>
                <td className="px-4 py-3 font-mono-pd text-emerald-400">
                  {s.invoice_no}
                  {s.status === "returned" && <Badge variant="outline" className="ml-2 border-red-500/40 text-red-300 text-[9px]">KTHYER</Badge>}
                  {s.status === "partial_return" && <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-300 text-[9px]">PJESËRISHT</Badge>}
                </td>
                <td className="px-4 py-3 font-mono-pd text-xs text-slate-400">{(s.created_at || "").slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-3">{s.customer_name || "Klient i rastit"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={
                    s.payment_method === "cash" ? "border-emerald-500/40 text-emerald-300" :
                    s.payment_method === "card" ? "border-sky-500/40 text-sky-300" :
                    "border-amber-500/40 text-amber-300"
                  }>
                    {s.payment_method.toUpperCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono-pd font-semibold">{eur(s.total)}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-amber-400">{eur(s.due_amount)}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setView(s)} data-testid={`sale-view-${s.id}`}><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => window.open(`${API}/sales/${s.id}/invoice.pdf`, "_blank")} className="text-emerald-400" data-testid={`sale-pdf-${s.id}`}><Download className="w-4 h-4" /></Button>
                  <PrintMenu saleId={s.id} size="icon" testid={`sale-print-${s.id}`} />
                  <Button variant="ghost" size="sm" onClick={() => window.open(waLinkFor(s, customers), "_blank")} className="text-green-400" data-testid={`sale-whatsapp-${s.id}`}><MessageCircle className="w-4 h-4" /></Button>
                  {isAdmin && s.status !== "returned" && (
                    <Button variant="ghost" size="sm" onClick={() => setReturnFor(s.id)} className="text-amber-400" data-testid={`sale-return-${s.id}`}>
                      <Undo2 className="w-4 h-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Pa shitje.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="bg-[#141C2B] border-slate-800 max-w-2xl">
          <DialogHeader><DialogTitle>Fatura {view?.invoice_no}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Klienti:</span> {view.customer_name || "Klient i rastit"}</div>
                <div><span className="text-slate-500">Data:</span> {(view.created_at || "").slice(0, 16).replace("T", " ")}</div>
                <div><span className="text-slate-500">Shitësi:</span> {view.created_by_name || "—"}</div>
                <div><span className="text-slate-500">Pagesa:</span> {view.payment_method?.toUpperCase()}</div>
              </div>
              <div className="data-grid bg-[#0B0F17] mt-2">
                <table className="w-full text-xs">
                  <thead className="text-slate-500 font-mono-pd uppercase"><tr>
                    <th className="px-3 py-2 text-left">Produkti</th><th className="px-3 py-2 text-left">IMEI</th><th className="px-3 py-2 text-right">Sasia</th><th className="px-3 py-2 text-right">Çmim</th><th className="px-3 py-2 text-right">Totali</th>
                  </tr></thead>
                  <tbody>
                    {view.items.map((it, i) => (
                      <tr key={i} className="border-t border-slate-800">
                        <td className="px-3 py-2">{it.product_name}</td>
                        <td className="px-3 py-2 font-mono-pd text-indigo-300">{it.imei || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono-pd">{it.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono-pd">{eur(it.sale_price)}</td>
                        <td className="px-3 py-2 text-right font-mono-pd text-emerald-400">{eur(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-6 text-sm pt-2">
                <div className="space-y-1 text-right">
                  <div><span className="text-slate-500">Nëntotali:</span> <span className="font-mono-pd ml-3">{eur(view.subtotal)}</span></div>
                  <div><span className="text-slate-500">Zbritja:</span> <span className="font-mono-pd ml-3">-{eur(view.discount)}</span></div>
                  <div className="text-base font-bold"><span>Totali:</span> <span className="font-mono-pd text-emerald-400 ml-3">{eur(view.total)}</span></div>
                  <div><span className="text-slate-500">Paguar:</span> <span className="font-mono-pd ml-3">{eur(view.paid_amount)}</span></div>
                  <div><span className="text-slate-500">Borxh:</span> <span className="font-mono-pd text-amber-400 ml-3">{eur(view.due_amount)}</span></div>
                </div>
              </div>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" onClick={() => window.open(`${API}/sales/${view.id}/invoice.pdf`, "_blank")}><Download className="w-4 h-4 mr-2" /> Shkarko PDF</Button>
              <Button variant="outline" className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10"
                onClick={() => window.open(waLinkFor(view, customers), "_blank")} data-testid={`sale-whatsapp-view-${view.id}`}>
                <MessageCircle className="w-4 h-4 mr-2" /> Dërgo në WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReturnDialog saleId={returnFor} onClose={() => setReturnFor(null)} onDone={load} />
    </div>
  );
}
