import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { inp } from "./util";

const fail = (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail));

// Correct an automatic entry (sale/purchase/expense/payment/return) – the original document stays untouched
export const EntryEditDialog = ({ entryKey, onClose, onSaved }) => {
  const [e, setE] = useState(null);
  const [f, setF] = useState({});
  useEffect(() => {
    if (!entryKey) return;
    setE(null);
    api.get("/daybook/entry", { params: { key: entryKey } }).then(({ data }) => {
      setE(data);
      setF({ hyrje: data.hyrje, dalje: data.dalje, method: data.method, description: data.description, invoice_no: data.invoice_no, cost: data.cost_missing ? "" : data.cost, reason: "" });
    }).catch((err) => { fail(err); onClose(); });
  }, [entryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const body = { key: entryKey, method: f.method, description: f.description, invoice_no: f.invoice_no, reason: f.reason };
    if (isIn) body.hyrje = Number(f.hyrje) || 0; else body.dalje = Number(f.dalje) || 0;
    if (e.source === "sale" && f.cost !== "" && Number(f.cost) !== e.cost) body.cost = Number(f.cost);
    try { await api.put("/daybook/override", body); toast.success("Korrigjimi u ruajt"); onClose(); onSaved && onSaved(); } catch (err) { fail(err); }
  };
  const restore = async () => {
    if (!window.confirm("Kthe vlerat origjinale të dokumentit?")) return;
    await api.delete("/daybook/override", { params: { key: entryKey } });
    toast.success("U kthyen vlerat origjinale"); onClose(); onSaved && onSaved();
  };
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const isIn = e && (e.source === "sale" || e.type === "Arkëtim borxhi");

  return (
    <Dialog open={!!entryKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#141C2B] border-slate-800 text-slate-100" data-testid="entry-edit-dialog">
        <DialogHeader><DialogTitle>Korrigjo transaksionin {e ? `· ${e.type}` : ""}</DialogTitle></DialogHeader>
        {!e ? <div className="py-6 text-center text-slate-500">Duke u ngarkuar…</div> : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Përshkrimi</Label><Input value={f.description} onChange={(x) => set({ description: x.target.value })} className={inp} data-testid="entry-edit-description" /></div>
            <div><Label>Nr. faturës</Label><Input value={f.invoice_no} onChange={(x) => set({ invoice_no: x.target.value })} className={inp} data-testid="entry-edit-invoice" /></div>
            <div><Label>Pagesa</Label>
              <Select value={f.method} onValueChange={(v) => set({ method: v })}>
                <SelectTrigger className={inp} data-testid="entry-edit-method"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bankë</SelectItem></SelectContent>
              </Select>
            </div>
            {isIn && <div><Label>Hyrje (€)</Label><Input type="number" step="0.01" value={f.hyrje} onChange={(x) => set({ hyrje: x.target.value })} className={inp} data-testid="entry-edit-hyrje" /></div>}
            {!isIn && <div><Label>Dalje (€)</Label><Input type="number" step="0.01" value={f.dalje} onChange={(x) => set({ dalje: x.target.value })} className={inp} data-testid="entry-edit-dalje" /></div>}
            {e.source === "sale" && (
              <div><Label>Kostoja e mallit (€)</Label><Input type="number" step="0.01" value={f.cost} placeholder={e.cost_missing ? "Mungon – plotësoje" : ""} onChange={(x) => set({ cost: x.target.value })} className={inp} data-testid="entry-edit-cost" /></div>
            )}
            <div className="col-span-2"><Label>Arsyeja e korrigjimit</Label><Input value={f.reason} onChange={(x) => set({ reason: x.target.value })} className={inp} data-testid="entry-edit-reason" /></div>
            <div className="col-span-2 text-[11px] text-slate-500">Korrigjimi ruhet në historik (data, ora, përdoruesi). Dokumenti origjinal ({eur(e.value)}) nuk ndryshohet.</div>
            <div className="col-span-2 flex justify-between gap-2">
              {e.corrected ? <Button variant="outline" onClick={restore} data-testid="entry-edit-restore">Kthe origjinalin</Button> : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Anulo</Button>
                <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="entry-edit-save">Ruaj korrigjimin</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const CorrectButton = ({ entryKey, onSaved }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Korrigjo në Qarkullimet Ditore" className="text-sky-500" data-testid={`correct-${entryKey}`}>
        <Pencil className="w-4 h-4" />
      </Button>
      <EntryEditDialog entryKey={open ? entryKey : null} onClose={() => setOpen(false)} onSaved={onSaved} />
    </>
  );
};
