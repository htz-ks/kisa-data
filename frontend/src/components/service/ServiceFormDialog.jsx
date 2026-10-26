import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { todayLocal } from "@/components/daybook/util";

const inp = "mt-1 bg-slate-900 border-slate-800";
const blank = () => ({ first_name: "", last_name: "", phone: "", device: "", defect: "", received_date: todayLocal(), price: "", parts_cost: "", notes: "" });

export const ServiceFormDialog = ({ open, service, onClose, onSaved }) => {
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(service ? { ...blank(), ...service, price: service.price ?? "", parts_cost: service.parts_cost ?? "" } : blank());
  }, [open, service]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const num = (v) => (v === "" || v == null ? null : Number(v));

  const save = async () => {
    if (!f.first_name.trim() || !f.phone.trim() || !f.device.trim() || !f.defect.trim()) return toast.error("Plotëso emrin, telefonin, pajisjen dhe defektin");
    setBusy(true);
    try {
      const body = { first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: f.phone.trim(), device: f.device.trim(), defect: f.defect.trim(),
        received_date: f.received_date, price: num(f.price), parts_cost: num(f.parts_cost), notes: f.notes };
      const { data } = service ? await api.put(`/services/${service.id}`, body) : await api.post("/services", body);
      toast.success(service ? "Servisi u ndryshua" : `Servisi ${data.number} u regjistrua`);
      onClose(); onSaved(data, !service);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Nuk u ruajt"); }
    finally { setBusy(false); }
  };

  const field = (k, label, props = {}) => (
    <div className={props.wide ? "sm:col-span-2" : ""}>
      <Label>{label}</Label>
      <Input value={f[k]} onChange={(e) => set({ [k]: e.target.value })} className={inp} data-testid={`service-${k.replace("_", "-")}-input`} {...props.input} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[#141C2B] border-slate-800 text-slate-100 max-h-[92vh] overflow-y-auto" data-testid="service-form-dialog">
        <DialogHeader><DialogTitle>{service ? `Ndrysho servisin ${service.number}` : "Pranim i ri në servis"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("first_name", "Emri i klientit *")}
          {field("last_name", "Mbiemri i klientit")}
          {field("phone", "Numri i telefonit të klientit *", { input: { inputMode: "tel" } })}
          {field("received_date", "Data e pranimit", { input: { type: "date" } })}
          {field("device", "Marka dhe modeli i telefonit *", { wide: true, input: { placeholder: "p.sh. Samsung Galaxy S21" } })}
          <div className="sm:col-span-2">
            <Label>Defekti / përshkrimi i problemit *</Label>
            <Textarea value={f.defect} onChange={(e) => set({ defect: e.target.value })} rows={2} className={inp} data-testid="service-defect-input" />
          </div>
          {field("price", "Çmimi i riparimit (€) – opsional", { input: { type: "number", step: "0.01", min: "0" } })}
          {field("parts_cost", "Kostoja e pjesëve (€) – opsional", { input: { type: "number", step: "0.01", min: "0" } })}
          <div className="sm:col-span-2">
            <Label>Shënime shtesë</Label>
            <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={inp} data-testid="service-notes-input" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="service-cancel-btn">Anulo</Button>
          <Button onClick={save} disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="service-save-btn">
            {service ? "Ruaj ndryshimet" : "Regjistro"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
