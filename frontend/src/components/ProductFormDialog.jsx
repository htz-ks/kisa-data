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

const EMPTY_SRC = { seller_type: "supplier", supplier_id: "", citizen_name: "", citizen_phone: "", citizen_personal_no: "" };

const PurchaseSourceFields = ({ src, setSrc, suppliers, citizens, total, paid, setPaid, inp }) => {
  const pickCitizen = (name) => {
    const c = citizens.find((x) => x.name === name);
    setSrc({ ...src, citizen_name: name, ...(c ? { citizen_phone: c.phone || "", citizen_personal_no: c.personal_no || "" } : {}) });
  };
  return (
    <div className="col-span-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3" data-testid="product-purchase-section">
      <div className="text-sm font-semibold text-emerald-300">Blerja — nga kush e bleve? (shtohet direkt në stok)</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Shitësi</Label>
          <Select value={src.seller_type} onValueChange={(v) => setSrc({ ...src, seller_type: v })}>
            <SelectTrigger className={inp} data-testid="product-seller-type-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="supplier">Furnitor</SelectItem>
              <SelectItem value="citizen">Qytetar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {src.seller_type === "supplier" ? (
          <div>
            <Label>Furnitori</Label>
            <Select value={src.supplier_id || "none"} onValueChange={(v) => setSrc({ ...src, supplier_id: v === "none" ? "" : v })}>
              <SelectTrigger className={inp} data-testid="product-supplier-select"><SelectValue placeholder="Zgjidh furnitorin" /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="none">— Pa furnitor —</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label>Emri i qytetarit *</Label>
            <Input list="citizens-list" value={src.citizen_name} onChange={(e) => pickCitizen(e.target.value)} className={inp} data-testid="product-citizen-name-input" />
            <datalist id="citizens-list">{citizens.map((c) => <option key={c.id} value={c.name}>{c.personal_no}</option>)}</datalist>
          </div>
        )}
        {src.seller_type === "citizen" && (
          <>
            <div>
              <Label>Telefoni</Label>
              <Input value={src.citizen_phone} onChange={(e) => setSrc({ ...src, citizen_phone: e.target.value })} className={inp} data-testid="product-citizen-phone-input" />
            </div>
            <div>
              <Label>Nr. personal</Label>
              <Input value={src.citizen_personal_no} onChange={(e) => setSrc({ ...src, citizen_personal_no: e.target.value })} className={inp} data-testid="product-citizen-personal-input" />
            </div>
          </>
        )}
        <div>
          <Label>Totali i blerjes</Label>
          <div className="mt-1 h-9 flex items-center font-mono-pd text-emerald-300" data-testid="product-purchase-total">€ {total.toFixed(2)}</div>
        </div>
        <div>
          <Label>Paguar (€)</Label>
          <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className={inp} data-testid="product-purchase-paid-input" />
          {Number(paid) < total && <div className="text-[11px] text-amber-400 mt-1">Borxh: € {(total - Number(paid || 0)).toFixed(2)}</div>}
        </div>
      </div>
    </div>
  );
};

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Huawei", "Nokia"];

// Random EAN-13 starting with "20" (in-store range) incl. check digit
export function generateEan13() {
  let d = "20";
  for (let i = 0; i < 10; i++) d += Math.floor(Math.random() * 10);
  const sum = d.split("").reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return d + ((10 - (sum % 10)) % 10);
}

export const ProductFormDialog = ({ open, onOpenChange, editId = null, initial = EMPTY_PRODUCT, onSaved, catalogOnly = false }) => {
  const [form, setForm] = useState(initial);
  const [imeiInput, setImeiInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [src, setSrc] = useState(EMPTY_SRC);
  const [paid, setPaidRaw] = useState("");
  const [paidTouched, setPaidTouched] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [citizens, setCitizens] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_PRODUCT, ...initial }); setImeiInput("");
    setSrc(EMPTY_SRC); setPaidRaw(""); setPaidTouched(false);
    if (!editId) {
      Promise.all([api.get("/suppliers"), api.get("/citizens")])
        .then(([s, c]) => { setSuppliers(s.data); setCitizens(c.data); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // include IMEIs typed but not yet added (they are saved too) so the purchase total / paid match the backend
  const pendingCount = imeiInput.split(/[\s,;]+/).filter((v) => v && !form.imeis.includes(v)).length;
  const imeiCount = form.imeis.length + pendingCount;
  const qty = form.type === "phone" && imeiCount ? Math.max(imeiCount, Number(form.quantity) || 0) : Number(form.quantity) || 0;
  const purchaseTotal = (Number(form.cost_price) || 0) * qty;
  const paidValue = paidTouched ? paid : purchaseTotal.toFixed(2);
  const setPaid = (v) => { setPaidTouched(true); setPaidRaw(v); };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const splitImeis = (text) => text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const addImei = () => {
    const vals = [...new Set(splitImeis(imeiInput))];
    if (!vals.length) return;
    const taken = new Set([...form.imeis, ...(form._existing_imeis || [])]);
    const fresh = vals.filter((v) => !taken.has(v));
    if (fresh.length < vals.length) toast.error("Ky IMEI është shtuar tashmë");
    setForm((f) => ({ ...f, imeis: [...f.imeis, ...fresh] }));
    setImeiInput("");
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Shkruaj emrin e artikullit"); return; }
    const pending = splitImeis(imeiInput).filter((v) => !form.imeis.includes(v));
    const allImeis = form.type === "phone" ? [...form.imeis, ...pending] : [];
    setSaving(true);
    try {
      const payload = {
        ...form,
        imeis: allImeis,
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        wholesale_price: Number(form.wholesale_price) || 0,
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        warranty_months: Number(form.warranty_months) || 0,
      };
      if (catalogOnly) { payload.quantity = 0; payload.imeis = []; }
      else if (!editId) payload.purchase = { ...src, paid_amount: Number(paidValue) || 0 };
      let data;
      if (editId) {
        delete payload.imeis;
        delete payload.type;
        delete payload._existing_imeis;
        if (allImeis.length) payload.add_imeis = allImeis;
        ({ data } = await api.put(`/products/${editId}`, payload));
        toast.success("Produkti u përditësua");
      } else {
        delete payload._existing_imeis;
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
          {form.type === "phone" && !catalogOnly && (
            <div className="col-span-2 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3" data-testid="product-imei-section">
              <Label>IMEI {editId ? "(shto IMEI të reja)" : ""}</Label>
              <div className="flex gap-2 mt-1">
                <Input value={imeiInput} onChange={(e) => setImeiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImei())}
                  placeholder="Shkruaj / skano IMEI dhe shtyp Enter" className="bg-slate-900 border-slate-800 font-mono-pd" data-testid="product-imei-input" />
                <Button type="button" onClick={addImei} variant="outline" data-testid="product-imei-add-btn">Shto</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form._existing_imeis || []).map((im) => (
                  <span key={im} className="imei-badge opacity-70" title="Në stok">{im}</span>
                ))}
                {form.imeis.map((im, i) => (
                  <span key={i} className="imei-badge" data-testid={`imei-badge-${i}`}>
                    {im}
                    <button type="button" onClick={() => set({ imeis: form.imeis.filter((_, j) => j !== i) })} className="ml-1 text-red-400">×</button>
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">IMEI shfaqet automatikisht te Shitja vendore. Sasia llogaritet nga numri i IMEI-ve.</div>
            </div>
          )}
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
          <div className={catalogOnly ? "hidden" : ""}>
            <Label>Sasia</Label>
            <Input type="number" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} className={inp} data-testid="product-quantity-input" />
            {form.type === "phone" && <div className="text-[11px] text-slate-500 mt-1">Për telefona shto IMEI më lart.</div>}
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
          {!editId && !catalogOnly && (
            <PurchaseSourceFields src={src} setSrc={setSrc} suppliers={suppliers} citizens={citizens}
              total={purchaseTotal} paid={paidValue} setPaid={setPaid} inp={inp} />
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
