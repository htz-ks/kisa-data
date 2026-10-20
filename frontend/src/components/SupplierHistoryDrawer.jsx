import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Truck } from "lucide-react";
import { DebtLedger } from "@/components/DebtLedger";
import { SaleDebtDetail } from "@/components/CustomerHistoryDrawer";

const PurchaseCard = ({ p, dd, open, onToggle }) => (
  <div className={`p-3 rounded-lg bg-slate-900/40 border ${open ? "border-amber-500/50" : "border-slate-800"}`} data-testid={`supplier-purchase-${p.id}`}>
    <div className={`flex justify-between items-center ${dd ? "cursor-pointer" : ""}`} onClick={() => dd && onToggle()} data-testid={`supplier-purchase-toggle-${p.id}`}>
      <div>
        <div className="text-sm font-medium">{(p.items || []).map((i) => i.product_name).join(", ") || "Blerje"}</div>
        <div className="text-xs text-slate-500 font-mono-pd">{(p.created_at || "").slice(0, 16).replace("T", " ")}</div>
      </div>
      <div className="text-right">
        <div className="font-mono-pd font-bold">{eur(p.total)}</div>
        {dd && (dd.remaining > 0
          ? <div className="text-xs text-amber-400 font-mono-pd">Mbetet {eur(dd.remaining)}</div>
          : <div className="text-xs text-emerald-400 font-mono-pd">Borxhi i shlyer</div>)}
      </div>
    </div>
    {dd && open && <SaleDebtDetail s={p} dd={dd} paidLabel="Paguar në blerje" debtLabel="Borxhi i blerjes" />}
  </div>
);

export default function SupplierHistoryDrawer({ supplierId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!supplierId) return;
    setLoading(true);
    api.get(`/suppliers/${supplierId}/history`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, [supplierId]);

  const s = data?.supplier;
  return (
    <Sheet open={!!supplierId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="bg-[#0D131E] border-slate-800 w-full sm:max-w-xl overflow-y-auto" data-testid="supplier-history-drawer">
        <SheetHeader><SheetTitle className="text-slate-100">Historia e furnitorit</SheetTitle></SheetHeader>
        {loading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>}
        {data && (
          <div className="mt-4 space-y-5">
            <div className="stat-card flex items-start justify-between">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2"><Truck className="w-5 h-5 text-slate-500" />{s.name}</h3>
                {s.phone && <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><Phone className="w-3 h-3" /><span className="font-mono-pd">{s.phone}</span></div>}
              </div>
              <Badge variant="outline" className={s.balance > 0 ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300"}>
                Borxh: {eur(s.balance || 0)}
              </Badge>
            </div>
            <DebtLedger customer={s} ledger={data.ledger || []} pdfPath={`/suppliers/${s.id}/statement.pdf`} />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="stat-card"><div className="text-2xl font-extrabold">{data.totals.purchases_count}</div><div className="text-[10px] uppercase text-slate-500">Blerje</div></div>
              <div className="stat-card"><div className="text-lg font-extrabold">{eur(data.totals.total_bought)}</div><div className="text-[10px] uppercase text-slate-500">Totali</div></div>
              <div className="stat-card"><div className="text-lg font-extrabold text-emerald-400">{eur(data.totals.total_paid)}</div><div className="text-[10px] uppercase text-slate-500">Paguar</div></div>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-2">Blerjet</h4>
              <div className="space-y-2">
                {data.purchases.map((p) => (
                  <PurchaseCard key={p.id} p={p} dd={data.purchase_debts?.[p.id]} open={openId === p.id}
                    onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
                ))}
                {data.purchases.length === 0 && <div className="text-sm text-slate-500">Pa blerje.</div>}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
