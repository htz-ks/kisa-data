import { useEffect, useState } from "react";
import api, { eur, API } from "@/lib/api";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Phone, Mail, MapPin } from "lucide-react";
import { DebtActions } from "@/components/DebtLedger";

export const Line = ({ label, value, cls = "" }) => (
  <div className="flex justify-between"><span className="text-slate-400">{label}</span><span className={`font-mono-pd ${cls}`}>{value}</span></div>
);

export const SaleDebtDetail = ({ s, dd, paidLabel = "Paguar në shitje", debtLabel = "Borxhi i faturës" }) => (
  <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1 text-xs" data-testid={`sale-debt-detail-${s.id}`}>
    <Line label="Totali i faturës" value={eur(s.total)} />
    <Line label={paidLabel} value={eur(dd.paid_at_sale)} cls="text-emerald-400" />
    <Line label={debtLabel} value={eur(dd.original_debt)} cls="text-amber-400" />
    {dd.returns.map((r, i) => (
      <Line key={`r${i}`} label={`Kthim mall · ${(r.date || "").slice(0, 10)}`} value={`− ${eur(r.amount)}`} cls="text-sky-400" />
    ))}
    {dd.payments.length === 0 && <div className="text-slate-500">Asnjë pagesë për këtë borxh ende.</div>}
    {dd.payments.map((p, i) => (
      <Line key={`p${i}`} label={`Pagesë · ${(p.date || "").slice(0, 16).replace("T", " ")}`} value={`− ${eur(p.amount)}`} cls="text-emerald-400" />
    ))}
    <div className="flex justify-between pt-1 border-t border-slate-800/60 font-bold">
      <span>Mbetet</span>
      <span className={`font-mono-pd ${dd.remaining > 0 ? "text-amber-400" : "text-emerald-400"}`} data-testid={`sale-debt-remaining-${s.id}`}>{eur(dd.remaining)}</span>
    </div>
  </div>
);

export default function CustomerHistoryDrawer({ customerId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    api.get(`/customers/${customerId}/history`)
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [customerId]);

  return (
    <Sheet open={!!customerId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="bg-[#0D131E] border-slate-800 w-full sm:max-w-xl overflow-y-auto" data-testid="customer-history-drawer">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Historia e klientit</SheetTitle>
        </SheetHeader>

        {loading && <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>}

        {data && (
          <div className="mt-4 space-y-5">
            {/* Customer info */}
            <div className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-extrabold">{data.customer.name}</h3>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    {data.customer.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> <span className="font-mono-pd">{data.customer.phone}</span></div>}
                    {data.customer.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {data.customer.email}</div>}
                    {data.customer.address && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {data.customer.address}</div>}
                  </div>
                </div>
                <div className="text-right" data-testid="customer-current-debt">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">Borxhi aktual</div>
                  <div className={`text-3xl font-extrabold font-mono-pd ${data.customer.balance > 0 ? "text-amber-400" : "text-emerald-400"}`}>{eur(data.customer.balance || 0)}</div>
                </div>
              </div>
            </div>

            <DebtActions customer={data.customer}
              pdfPath={`/customers/${data.customer.id}/statement.pdf`}
              shareUrl={`${API}/public/statement/${data.customer.id}/${data.share_token}.pdf`}
              openDocs={data.sales.filter((x) => data.sale_debts?.[x.id]?.remaining > 0).map((x) => ({ doc: x.invoice_no, remaining: data.sale_debts[x.id].remaining }))} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
