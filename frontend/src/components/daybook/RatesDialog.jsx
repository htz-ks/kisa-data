import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent } from "lucide-react";
import { toast } from "sonner";

const FIELDS = [
  ["card_coef", "Koeficienti Card-Bank (×)", "0.01"],
  ["bank_fee_pct", "Komisioni bankar (%)", "0.1"],
  ["vat_pct", "TVSH (%)", "0.1"],
  ["profit_tax_pct", "Tatimi në fitim (%)", "0.1"],
];

export const RatesButton = ({ onSaved }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(null);
  useEffect(() => { if (open) api.get("/finance-settings").then(({ data }) => setF(data)); }, [open]);
  const save = async () => {
    try {
      await api.put("/finance-settings", Object.fromEntries(FIELDS.map(([k]) => [k, Number(f[k])])));
      toast.success("Normat u ruajtën – vlejnë për shitjet e reja"); setOpen(false); onSaved && onSaved();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Vlerë e pavlefshme"); }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="rates-settings-btn"><Percent className="w-4 h-4 mr-1" /> Normat</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-[#141C2B] border-slate-800 text-slate-100" data-testid="rates-dialog">
          <DialogHeader><DialogTitle>Normat: Card-Bank, komisioni, TVSH, tatimi</DialogTitle></DialogHeader>
          {f && FIELDS.map(([k, l, step]) => (
            <div key={k}><Label>{l}</Label>
              <Input type="number" step={step} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid={`rates-${k}`} />
            </div>
          ))}
          <p className="text-[11px] text-slate-500">Ndryshimet vlejnë vetëm për shitjet e reja; faturat e vjetra ruajnë normat e ditës së shitjes. Verifiko formulat tatimore me kontabilistin.</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="rates-save">Ruaj</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
};
