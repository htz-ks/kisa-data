import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

export const EMPTY_PRODUCT = {
  name: "", type: "accessory", brand: "", barcode: "",
  cost_price: 0, sale_price: 0, wholesale_price: 0, quantity: 0, low_stock_threshold: 2, warranty_months: 12,
  gb: "", ram: "", battery_percent: "", imeis: [], description: "",
};

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Huawei", "Nokia"];

// Random EAN-13 starting with "20" (in-store range) incl. check digit
export function generateEan13() {
  let d = "20";
  for (let i = 0; i < 10; i++) d += Math.floor(Math.random() * 10);
  const sum = d.split("").reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return d + ((10 - (sum % 10)) % 10);
}

export const ProductFormDialog = ({ open, onOpenChange, editId = null, initial = EMPTY_PRODUCT, onSaved }) => {
  const [form, setForm] = useState(initial);
  const [imeiInput, setImeiInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm({ ...EMPTY_PRODUCT, ...initial }); setImeiInput(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addImei = () => {
    const v = imeiInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, imeis: [...f.imeis, v] }));
    setImeiInput("");
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Shkruaj emrin e artikullit"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        wholesale_price: Number(form.wholesale_price) || 0,
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        warranty_months: Number(form.warranty_months) || 0,
      };
      let data;
      if (editId) {
        delete payload.imeis;
        delete payload.type;
        ({ data } = await api.put(`/products/${editId}`, payload));
        toast.success("Produkti u përditësua");
      } else {
        ({ data } = await api.post("/products", payload));
        toast.success(`Produkti u shtua (${data.code})`);
      }
      onOpenChange(false);
      onSaved && (await onSaved(data));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gabim");
    } finally {
      setSaving(false);
    }
  };

  const inp = "mt-1 bg-slate-900 border-slate-800";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#141C2B] border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto" data-testid="product-form-dialog">
        <DialogHeader>
          <DialogTitle>{editId ? "Edito produktin" : "Shto produkt të ri"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Emri *</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inp} data-testid="product-name-input" />
          </div>
          <div>
            <Label>Lloji *</Label>
            <Select value={form.type} onValueChange={(v) => set({ type: v })} disabled={!!editId}>
              <SelectTrigger className={inp} data-testid="product-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Telefon (me IMEI)</SelectItem>
                <SelectItem value="accessory">Aksesor (sasi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Markë</Label>
            <Select value={form.brand || "none"} onValueChange={(v) => set({ brand: v === "none" ? "" : v })}>
              <SelectTrigger className={inp} data-testid="product-brand-select"><SelectValue placeholder="Zgjidh markën" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Pa markë —</SelectItem>
                {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Barkod</Label>
            <div className="flex gap-2 mt-1">
              <Input value={form.barcode} onChange={(e) => set({ barcode: e.target.value })}
                placeholder="Shkruaj ose gjenero" className="bg-slate-900 border-slate-800 font-mono-pd" data-testid="product-barcode-input" />
              <Button type="button" variant="outline" onClick={() => set({ barcode: generateEan13() })}
                title="Gjenero barkod automatik" data-testid="product-barcode-generate-btn">
                <Wand2 className="w-4 h-4 mr-1" /> Gjenero
              </Button>
            </div>
            {!editId && <div className="text-[11px] text-slate-500 mt-1">Nëse e lë bosh, gjenerohet automatikisht.</div>}
          </div>
          <div>
            <Label>Çmim blerje (€)</Label>
            <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => set({ cost_price: e.target.value })} className={inp} data-testid="product-cost-input" />
          </div>
          <div>
            <Label>Çmim shitje me pakicë (€)</Label>
            <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => set({ sale_price: e.target.value })} className={inp} data-testid="product-price-input" />
          </div>
          <div>
            <Label>Çmim shitje me shumicë (€)</Label>
            <Input type="number" step="0.01" value={form.wholesale_price} onChange={(e) => set({ wholesale_price: e.target.value })} className={inp} data-testid="product-wholesale-input" />
          </div>
          <div>
            <Label>Sasia</Label>
            <Input type="number" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} className={inp} data-testid="product-quantity-input" />
            {form.type === "phone" && <div className="text-[11px] text-slate-500 mt-1">Shkruaje sasinë ose shto IMEI poshtë.</div>}
          </div>
          <div>
            <Label>Stoku Alarm</Label>
            <Input type="number" value={form.low_stock_threshold} onChange={(e) => set({ low_stock_threshold: e.target.value })} className={inp} data-testid="product-threshold-input" />
          </div>
          {form.type === "phone" && (
            <>
              <div>
                <Label>Garanci (muaj)</Label>
                <Input type="number" value={form.warranty_months} onChange={(e) => set({ warranty_months: e.target.value })} className={inp} data-testid="product-warranty-input" />
              </div>
              <div>
                <Label>Memorie (GB)</Label>
                <Input value={form.gb} onChange={(e) => set({ gb: e.target.value })} placeholder="p.sh. 128" className={inp} data-testid="product-gb-input" />
              </div>
              <div>
                <Label>RAM</Label>
                <Input value={form.ram} onChange={(e) => set({ ram: e.target.value })} placeholder="p.sh. 8" className={inp} data-testid="product-ram-input" />
              </div>
              <div>
                <Label>Bateria (%)</Label>
                <Input value={form.battery_percent} onChange={(e) => set({ battery_percent: e.target.value })} placeholder="p.sh. 95" className={inp} data-testid="product-battery-input" />
              </div>
            </>
          )}
          {form.type === "phone" && !editId && (
            <div className="col-span-2">
              <Label>Shto IMEI (opsionale, mund t'i shtosh me blerje)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={imeiInput} onChange={(e) => setImeiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImei())}
                  placeholder="Shtyp IMEI dhe Enter" className="bg-slate-900 border-slate-800 font-mono-pd" data-testid="product-imei-input" />
                <Button type="button" onClick={addImei} variant="outline" data-testid="product-imei-add-btn">Shto</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.imeis.map((im, i) => (
                  <span key={i} className="imei-badge" data-testid={`imei-badge-${i}`}>
                    {im}
                    <button type="button" onClick={() => set({ imeis: form.imeis.filter((_, j) => j !== i) })} className="ml-1 text-red-400">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2">
            <Label>Përshkrim</Label>
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} className={inp} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="product-cancel-btn">Anulo</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="product-save-btn">
            Ruaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
