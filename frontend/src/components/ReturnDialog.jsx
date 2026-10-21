import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Undo2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

/**
 * Opens for a given saleId. Loads the sale, lets admin pick items/quantities
 * to return, shows live refund amount and submits.
 */
export default function ReturnDialog({ saleId, onClose, onDone }) {
  const [sale, setSale] = useState(null);
  const [qty, setQty] = useState({}); // index -> quantity
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saleId) { setSale(null); setQty({}); setReason(""); return; }
    api.get(`/sales/${saleId}`).then(({ data }) => {
      setSale(data);
      const init = {};
      (data.items || []).forEach((_, i) => (init[i] = 0));
      setQty(init);
    });
  }, [saleId]);

  const available = (i) => {
    const it = sale?.items?.[i];
    if (!it) return 0;
    const already = Number(it.returned_quantity || 0);
    return Math.max(0, Number(it.quantity) - already);
  };

  const setItemQty = (i, v) => {
    const max = available(i);
    const n = Math.max(0, Math.min(max, Number(v) || 0));
    setQty((p) => ({ ...p, [i]: n }));
  };

  const refund = sale ? Object.entries(qty).reduce((s, [i, q]) => s + Number(sale.items[i]?.sale_price || 0) * Number(q || 0), 0) : 0;

  const submit = async () => {
    const items = Object.entries(qty).filter(([, q]) => Number(q) > 0).map(([i, q]) => ({ index: Number(i), quantity: Number(q) }));
    if (items.length === 0) { toast.error("Zgjidh të paktën një artikull"); return; }
    setSaving(true);
    try {
      await api.post(`/sales/${saleId}/return`, { items, reason });
      toast.success("Rikthimi u ruajt");
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!saleId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#141C2B] border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-amber-400" /> Rikthim produkti
            {sale && <Badge variant="outline" className="font-mono-pd">{sale.invoice_no}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {sale && (
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              Klienti: <span className="text-slate-300">{sale.customer_name || "Qytetar"}</span> · Pagesa: <span className="text-slate-300">{(sale.payment_method || "").toUpperCase()}</span>
            </div>

            <div className="space-y-2">
              {sale.items.map((it, i) => {
                const max = available(i);
                return (
                  <div key={i} className={`p-3 rounded-lg border ${max === 0 ? "bg-slate-900/20 border-slate-800 opacity-50" : "bg-slate-900/40 border-slate-800"}`} data-testid={`return-item-${i}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{it.product_name}</div>
                        {it.imei && <div className="imei-badge mt-1">{it.imei}</div>}
                        <div className="text-xs text-slate-500 mt-1">
                          {eur(it.sale_price)} × blerë {it.quantity}
                          {Number(it.returned_quantity || 0) > 0 && <span className="text-amber-400"> · të kthyera {it.returned_quantity}</span>}
                        </div>
                      </div>
                      {max === 0 ? (
                        <Badge variant="outline" className="border-slate-700 text-slate-500">Kthyer</Badge>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setItemQty(i, (qty[i] || 0) - 1)}><Minus className="w-3 h-3" /></Button>
                          <Input type="number" value={qty[i] || 0} onChange={(e) => setItemQty(i, e.target.value)}
                            className="w-14 h-8 text-center bg-slate-900 border-slate-800" data-testid={`return-qty-${i}`} />
                          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setItemQty(i, (qty[i] || 0) + 1)}><Plus className="w-3 h-3" /></Button>
                          <span className="text-xs text-slate-500 ml-1">/ {max}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label className="text-xs">Arsyeja (opsionale)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="p.sh. defekt, s'i përshtatet…" className="mt-1 bg-slate-900 border-slate-800" data-testid="return-reason-input" />
            </div>

            <div className="flex justify-between items-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="text-sm font-medium text-amber-200">Shuma për t'u kthyer</span>
              <span className="text-2xl font-bold text-amber-400 font-mono-pd" data-testid="return-refund-amount">{eur(refund)}</span>
            </div>

            {sale.customer_id && sale.due_amount > 0 && refund > 0 && (
              <div className="text-xs text-slate-400 bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                Klienti ka borxh prej {eur(sale.due_amount)}. Rikthimi do të zbresë së pari borxhin, dhe pjesa tjetër do të jepet si cash.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anulo</Button>
          <Button onClick={submit} disabled={saving || refund <= 0}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold" data-testid="return-submit-btn">
            {saving ? "Duke ruajtur…" : "Konfirmo Rikthimin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
