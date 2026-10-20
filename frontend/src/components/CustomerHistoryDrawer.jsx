import { useEffect, useState } from "react";
import api, { eur, API } from "@/lib/api";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Phone, Mail, MapPin, Receipt, Wallet, Package } from "lucide-react";
import { DebtLedger } from "@/components/DebtLedger";

const Line = ({ label, value, cls = "" }) => (
  <div className="flex justify-between"><span className="text-slate-400">{label}</span><span className={`font-mono-pd ${cls}`}>{value}</span></div>
);

const SaleDebtDetail = ({ s, dd }) => (
  <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1 text-xs" data-testid={`sale-debt-detail-${s.id}`}>
    <Line label="Totali i faturës" value={eur(s.total)} />
    <Line label="Paguar në shitje" value={eur(dd.paid_at_sale)} cls="text-emerald-400" />
    <Line label="Borxhi i faturës" value={eur(dd.original_debt)} cls="text-amber-400" />
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
  const [openSale, setOpenSale] = useState(null);

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
                <Badge variant="outline" className={data.customer.balance > 0 ? "border-amber-500/40 text-amber-300" : "border-emerald-500/40 text-emerald-300"}>
                  Borxh: {eur(data.customer.balance || 0)}
                </Badge>
              </div>
            </div>

            {/* Debt history */}
            <DebtLedger customer={data.customer} ledger={data.ledger || []} />

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card p-3">
                <Receipt className="w-4 h-4 text-indigo-400 mb-1" />
                <div className="text-xl font-bold">{data.totals.orders_count}</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">Fatura</div>
              </div>
              <div className="stat-card p-3">
                <Package className="w-4 h-4 text-sky-400 mb-1" />
                <div className="text-xl font-bold font-mono-pd">{eur(data.totals.total_spent)}</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">Blerë</div>
              </div>
              <div className="stat-card p-3">
                <Wallet className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="text-xl font-bold font-mono-pd text-emerald-400">{eur(data.totals.total_paid)}</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">Paguar</div>
              </div>
            </div>

            {/* Sales list */}
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Receipt className="w-4 h-4" /> Faturat</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.sales.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">Pa fatura.</div>}
                {data.sales.map((s) => {
                  const dd = data.sale_debts?.[s.id];
                  return (
                  <div key={s.id} className={`p-3 rounded-lg bg-slate-900/40 border ${openSale === s.id ? "border-amber-500/50" : "border-slate-800"}`} data-testid={`history-sale-${s.id}`}>
                    <div className={`flex justify-between items-center ${dd ? "cursor-pointer" : ""}`}
                      onClick={() => dd && setOpenSale(openSale === s.id ? null : s.id)} data-testid={`history-sale-toggle-${s.id}`}>
                      <div>
                        <div className="font-mono-pd text-emerald-400 text-sm">{s.invoice_no}</div>
                        <div className="text-xs text-slate-500">{(s.created_at || "").slice(0, 16).replace("T", " ")}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono-pd font-semibold">{eur(s.total)}</div>
                        {dd && (dd.remaining > 0
                          ? <div className="text-xs text-amber-400 font-mono-pd">Mbetet {eur(dd.remaining)}</div>
                          : <div className="text-xs text-emerald-400 font-mono-pd">Borxhi i shlyer</div>)}
                      </div>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400"
                        onClick={(e) => { e.stopPropagation(); window.open(`${API}/sales/${s.id}/invoice.pdf`, "_blank"); }}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{s.items?.length || 0} artikuj · {s.payment_method?.toUpperCase()}{dd && openSale !== s.id ? " · kliko për pagesat" : ""}</div>
                    {dd && openSale === s.id && <SaleDebtDetail s={s} dd={dd} />}
                    {(s.items || []).some((it) => it.imei) && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1">
                        {s.items.filter((it) => it.imei).map((it, i) => {
                          const daysLeft = it.warranty_until
                            ? Math.ceil((new Date(it.warranty_until) - new Date()) / (1000 * 60 * 60 * 24))
                            : null;
                          return (
                            <div key={i} className="flex items-center justify-between text-xs" data-testid={`history-imei-${it.imei}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate text-slate-300">{it.product_name}</span>
                                <span className="imei-badge shrink-0">{it.imei}</span>
                              </div>
                              {daysLeft !== null && (
                                <span className={`shrink-0 font-mono-pd text-[10px] px-2 py-0.5 rounded-full border ${
                                  daysLeft > 30 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
                                  daysLeft > 0 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
                                  "text-red-400 border-red-500/40 bg-red-500/10"
                                }`}>
                                  {daysLeft > 0 ? `${daysLeft} ditë garanci` : "Garancia skaduar"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Payments list */}
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2"><Wallet className="w-4 h-4" /> Pagesat</h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {data.payments.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">Pa pagesa.</div>}
                {data.payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40 border border-slate-800">
                    <div>
                      <div className="text-xs text-slate-500 font-mono-pd">{(p.created_at || "").slice(0, 10)}</div>
                      <div className="text-xs text-slate-400">{p.notes || "—"}</div>
                    </div>
                    <div className="font-mono-pd text-emerald-400 font-semibold">{eur(p.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
