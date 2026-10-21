import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const EMPTY = { name: "", phone: "", address: "", credit_limit: "" };

export const QuickCustomerDialog = ({ open, onOpenChange, onCreated, kind = "customer" }) => {
  const isSup = kind === "supplier";
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF(EMPTY); }, [open]);

  const save = async () => {
    if (!f.name.trim()) { toast.error(isSup ? "Shkruaj emrin e furnitorit" : "Shkruaj emrin e klientit"); return; }
    setSaving(true);
    try {
      const { data } = await api.post(isSup ? "/suppliers" : "/customers", { ...f, name: f.name.trim(), credit_limit: Number(f.credit_limit) || 0 });
      toast.success(`${isSup ? "Furnitori" : "Klienti"} ${data.name} u shtua`);
      onOpenChange(false);
      await onCreated(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gabim");
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, props = {}) => (
    <div>
      <Label>{label}</Label>
      <Input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && save()} className="mt-1" data-testid={`quick-customer-${key}`} {...props} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="quick-customer-dialog">
        <DialogHeader><DialogTitle>{isSup ? "Shto furnitor të ri" : "Shto klient të ri"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {field("name", "Emri *", { autoFocus: true })}
          {field("phone", "Telefoni", { placeholder: "p.sh. 044 123 456" })}
          {field("address", "Adresa")}
          {!isSup && field("credit_limit", "Limiti i borxhit (€)", { type: "number", placeholder: "0 = pa limit" })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulo</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="quick-customer-save">
            {isSup ? "Ruaj furnitorin" : "Ruaj klientin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
