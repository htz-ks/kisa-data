import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductCombobox, norm } from "@/components/ProductCombobox";

// Parts taken from our stock for a service. For a saved service the stock moves immediately;
// for a new one the list is queued and sent right after the service is created.
export const ServiceParts = ({ service, queued, setQueued, onChanged }) => {
  const [products, setProducts] = useState([]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const loadProducts = () => api.get("/products").then(({ data }) => setProducts(data.filter((p) => p.type !== "phone")));
  useEffect(() => { loadProducts(); }, []);

  const list = service ? service.parts || [] : queued;
  // picking a product adds it right away, so it can never be forgotten before saving
  const add = async (pick) => {
    const q = Number(qty) || 0;
    if (!pick || busy) return;
    if (q < 1) return toast.error("Sasia duhet të jetë të paktën 1");
    const taken = service ? 0 : queued.filter((x) => x.product_id === pick.id).reduce((t, x) => t + x.quantity, 0);
    if (q + taken > (pick.quantity || 0)) return toast.error(`Në stok ka vetëm ${pick.quantity || 0} copë për ${pick.name}`);
    if (service) {
      setBusy(true);
      try { const { data } = await api.post(`/services/${service.id}/parts`, { product_id: pick.id, quantity: q }); toast.success(`${pick.name} × ${q} u zbrit nga stoku`); onChanged(data); loadProducts(); }
      catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
      finally { setBusy(false); }
    } else {
      setQueued([...queued, { id: `q${Date.now()}`, product_id: pick.id, name: pick.name, code: pick.code, quantity: q, cost_price: pick.cost_price || 0 }]);
      toast.success(`${pick.name} × ${q} u shtua – zbritet nga stoku kur ruhet servisi`);
    }
    setQty(1);
  };
  const remove = async (p) => {
    if (!service) return setQueued(queued.filter((x) => x.id !== p.id));
    if (!window.confirm(`Ta kthej ${p.name} × ${p.quantity} në stok?`)) return;
    const { data } = await api.delete(`/services/${service.id}/parts/${p.id}`);
    toast.success("U kthye në stok"); onChanged(data); loadProducts();
  };
  const onEnter = (q) => {
    const l = norm(q);
    const m = products.filter((p) => norm(p.barcode) === l || norm(p.code) === l);
    const found = m[0] || (products.filter((p) => norm(p.name).includes(l)).length === 1 ? products.find((p) => norm(p.name).includes(l)) : null);
    if (found) add(found);
    return !!found;
  };
  const total = list.reduce((t, p) => t + p.cost_price * p.quantity, 0);

  return (
    <div className="sm:col-span-2 border border-slate-800 rounded-lg p-3" data-testid="service-parts">
      <div className="flex items-center gap-2 font-semibold mb-2"><Package className="w-4 h-4 text-emerald-500" /> Pjesët nga stoku ynë</div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-20">
          <Label className="text-xs">Sasia</Label>
          <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 h-8 bg-slate-900 border-slate-800" data-testid="service-part-qty" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Produkti – zgjidhe dhe shtohet menjëherë</Label>
          <div className="mt-1"><ProductCombobox products={products} value={null} onPick={add} onEnter={onEnter} testId="service-part-product" /></div>
        </div>
      </div>
      {list.length > 0 && (
        <table className="w-full text-sm mt-2">
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50" data-testid={`service-part-${p.id}`}>
                <td className="py-1">{p.name}</td><td className="text-right font-mono">× {p.quantity}</td>
                <td className="text-right font-mono text-slate-400">{eur(p.cost_price * p.quantity)}</td>
                <td className="text-right w-8"><button type="button" onClick={() => remove(p)} className="text-rose-500" data-testid={`service-part-remove-${p.id}`}><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="text-[11px] text-slate-500 mt-1">
        {list.length ? `Kostoja e pjesëve nga stoku: ${eur(total)} – zbritet nga fitimi i servisit. ` : ""}
        {service ? "Stoku zbritet menjëherë." : "Stoku zbritet kur regjistrohet servisi."}
      </div>
    </div>
  );
};
