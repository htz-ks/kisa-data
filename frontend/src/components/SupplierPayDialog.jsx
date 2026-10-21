import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const SupplierPayDialog = ({ supplier, onClose, onPaid }) => {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (supplier) { setAmount(String(supplier.balance)); setNotes(""); } }, [supplier]);

  const pay = async () => {
    const value = Number(amount);
    if (!(value > 0)) return toast.error("Shkruaj shumën");
    setBusy(true);
    try {
      await api.post("/payments", { entity_type: "supplier", entity_id: supplier.id, amount: value, direction: "out", notes });
      toast.success(`U pagua ${eur(value)} te ${supplier.name}`);
      onClose(); onPaid && onPaid();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Pagesa dështoi");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#141C2B] border-slate-800 text-slate-100" data-testid="supplier-pay-dialog">
        <DialogHeader><DialogTitle>Paguaj furnitorin · {supplier?.name}</DialogTitle></DialogHeader>
        <div className="text-sm text-slate-400">Borxhi aktual: <span className="font-bold text-amber-400 font-mono-pd" data-testid="supplier-pay-balance">{eur(supplier?.balance || 0)}</span></div>
        <div>
          <Label>Shuma (€)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="mt-1 bg-slate-900 border-slate-800" data-testid="supplier-pay-amount-input" />
        </div>
        <div>
          <Label>Shënim</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-slate-900 border-slate-800" data-testid="supplier-pay-notes-input" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="supplier-pay-cancel-btn">Anulo</Button>
          <Button onClick={pay} disabled={busy} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold" data-testid="supplier-pay-submit-btn">Paguaj</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
