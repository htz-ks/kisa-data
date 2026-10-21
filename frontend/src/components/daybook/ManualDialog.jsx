import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { inp } from "./util";

const blank = (date, kind) => ({ date, kind, amount: "", method: "cash", description: "", invoice_no: "", in_profit: false });

// add (entry=null) or edit a manual cash in/out
export const ManualDialog = ({ open, date, kind = "in", entry, onClose, onSaved }) => {
  const [f, setF] = useState(blank(date, kind));
  useEffect(() => {
    if (!open) return;
    setF(entry ? { date: entry.date, kind: entry.kind, amount: entry.hyrje || entry.dalje, method: entry.method,
      description: entry.description, invoice_no: entry.invoice_no, in_profit: !!entry.in_profit } : blank(date, kind));
  }, [open, entry, date, kind]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!(Number(f.amount) > 0)) return toast.error("Shkruaj shumën");
    try {
      const body = { ...f, amount: Number(f.amount) };
      if (entry) await api.put(`/daybook/manual/${entry.source_id}`, body); else await api.post("/daybook/manual", body);
      toast.success("U ruajt"); onClose(); onSaved();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#141C2B] border-slate-800 text-slate-100" data-testid="manual-dialog">
        <DialogHeader><DialogTitle>{entry ? "Korrigjo" : "Shto"} {f.kind === "in" ? "hyrje" : "dalje"} manuale</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className={inp} data-testid="manual-date" /></div>
          <div><Label>Lloji</Label>
            <Select value={f.kind} onValueChange={(v) => set({ kind: v })}>
              <SelectTrigger className={inp} data-testid="manual-kind"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="in">Hyrje</SelectItem><SelectItem value="out">Dalje</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Përshkrimi</Label><Input value={f.description} onChange={(e) => set({ description: e.target.value })} className={inp} data-testid="manual-description" /></div>
          <div><Label>Shuma (€)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className={inp} data-testid="manual-amount" /></div>
          <div><Label>Pagesa</Label>
            <Select value={f.method} onValueChange={(v) => set({ method: v })}>
              <SelectTrigger className={inp} data-testid="manual-method"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bankë</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Nr. faturës</Label><Input value={f.invoice_no} onChange={(e) => set({ invoice_no: e.target.value })} className={inp} data-testid="manual-invoice" /></div>
          <label className="flex items-center gap-2 text-sm mt-6">
            <Checkbox checked={f.in_profit} onCheckedChange={(v) => set({ in_profit: !!v })} data-testid="manual-in-profit" />
            Llogarite në fitim/humbje
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="manual-save">Ruaj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
