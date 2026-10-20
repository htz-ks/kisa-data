import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Save, X, RefreshCw, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import BarcodeScanner from "@/components/BarcodeScanner";

const TODAY = () => new Date().toISOString().slice(0, 10);

function emptyRow() {
  return { product_id: "", _code: "", _barcode: "", _name: "", quantity: 1, unit: "copë", sale_price: 0, discount: 0, imei: "", _type: "accessory" };
}

/**
 * Prodata-style "Shitja vendore (I ri)" document entry.
 */
export default function SaleEntryPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [docDate, setDocDate] = useState(TODAY());
  const [dueDate, setDueDate] = useState(TODAY());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [priceMode, setPriceMode] = useState("retail"); // retail | wholesale
  const [paid, setPaid] = useState("");
  const [rows, setRows] = useState([emptyRow()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [newForRow, setNewForRow] = useState(null);
  const [scanRow, setScanRow] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const load = async () => {
    const [c, p] = await Promise.all([api.get("/customers"), api.get("/products")]);
    setCustomers(c.data);
    setProducts(p.data);
  };
  useEffect(() => { load(); }, []);

  const customer = customers.find((c) => c.id === customerId);
  const balance = customer?.balance || 0;
  const limit = customer?.credit_limit || 0;

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i, patch) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  const applyProduct = (i, prod, wantedImei = "") => {
    if (!prod) { updateRow(i, { product_id: "", _code: "", _barcode: "", _name: "", sale_price: 0, _type: "accessory", imei: "" }); return; }
    const price = priceMode === "wholesale" && prod.wholesale_price > 0 ? prod.wholesale_price : prod.sale_price;
    // auto-pick IMEI: scanned one, else first in-stock IMEI not used in another row
    const used = new Set(rows.filter((_, idx) => idx !== i).map((r) => r.imei).filter(Boolean));
    const imei = prod.type === "phone"
      ? wantedImei || ((prod.imeis || []).find((x) => x.status === "in_stock" && !used.has(x.imei))?.imei || "")
      : "";
    updateRow(i, {
      product_id: prod.id,
      _code: prod.code || prod.barcode || "",
      _barcode: prod.barcode || "",
      _name: prod.name,
      sale_price: price,
      quantity: prod.type === "phone" ? 1 : 1,
      _type: prod.type,
      imei,
    });
  };
  const pickProduct = (i, product_id) => applyProduct(i, products.find((p) => p.id === product_id));

  const findByCode = (i) => {
    const q = (rows[i]._code || "").trim().toLowerCase();
    if (!q) return;
    const prod = products.find((p) => (p.code || "").toLowerCase() === q || (p.barcode || "").toLowerCase() === q);
    if (prod) applyProduct(i, prod);
    else if (rows[i].product_id) return;
    else toast.error(`Nuk u gjet artikull me shifrën "${rows[i]._code}"`);
  };

  // Scan barcode (or phone IMEI) -> fill row, then add & focus a new empty row
  const scanBarcode = (i, raw) => {
    const q = (raw ?? rows[i]._barcode ?? "").trim();
    if (!q) return;
    let prod = products.find((p) => (p.barcode || "").toLowerCase() === q.toLowerCase());
    let imei = "";
    if (!prod) {
      prod = products.find((p) => (p.imeis || []).some((x) => x.imei === q && x.status === "in_stock"));
      if (prod) imei = q;
    }
    if (!prod) { toast.error(`Nuk u gjet artikull me barkodin "${q}"`); return; }
    applyProduct(i, prod, imei);
    if (i === rows.length - 1) {
      setRows((r) => [...r, emptyRow()]);
      setTimeout(() => document.querySelector(`[data-testid="sale-barcode-input-${i + 1}"]`)?.focus(), 50);
    }
  };

  const onProductCreated = async (prod) => {
    const p = await api.get("/products");
    setProducts(p.data);
    if (newForRow !== null) applyProduct(newForRow, prod);
    setNewForRow(null);
  };

  // when price mode changes, repick prices on existing rows
  useEffect(() => {
    setRows((rs) => rs.map((r) => {
      if (!r.product_id) return r;
      const p = products.find((x) => x.id === r.product_id);
      if (!p) return r;
      const price = priceMode === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sale_price;
      return { ...r, sale_price: price };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode]);

  const lineTotal = (r) => (Number(r.sale_price) || 0) * (Number(r.quantity) || 0) - (Number(r.discount) || 0);
  const subtotal = useMemo(() => rows.reduce((s, r) => s + lineTotal(r), 0), [rows]);
  const total = subtotal;

  const save = async () => {
    const items = rows.filter((r) => r.product_id).map((r) => ({
      product_id: r.product_id,
      quantity: Number(r.quantity) || 1,
      sale_price: Number(r.sale_price) || 0,
      imei: r.imei || null,
    }));
    if (items.length === 0) { toast.error("Shto të paktën një artikull"); return; }
    const totalDiscount = rows.reduce((s, r) => s + (Number(r.discount) || 0), 0);
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId || "",
        items,
        discount: totalDiscount,
        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : total,
        payment_method: paymentMethod,
        document_date: docDate,
        due_date: dueDate,
        notes,
      };
      const { data } = await api.post("/sales", payload);
      toast.success(`Fatura ${data.invoice_no} u ruajt`);
      navigate("/sales");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  // style helpers for the Prodata-like look
  const field = "h-9 bg-slate-50 border-slate-300 text-slate-900 focus-visible:ring-emerald-500";
  const label = "text-xs text-slate-600 font-medium";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6" data-testid="sale-entry-page">
      <div className="max-w-6xl mx-auto bg-white border border-slate-300 rounded-lg shadow-sm">
        {/* Title bar */}
        <div className="border-b border-slate-300 px-5 py-3 flex items-center justify-between bg-slate-50 rounded-t-lg">
          <h1 className="text-xl font-bold text-slate-900">Shitja vendore <span className="text-emerald-600 font-normal">(I ri)</span></h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/sales")} data-testid="sale-cancel-btn"><X className="w-4 h-4 mr-1" /> Anulo</Button>
            <Button size="sm" onClick={save} disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="sale-save-btn">
              <Save className="w-4 h-4 mr-1" /> Ruaj
            </Button>
          </div>
        </div>

        {/* Buyer + header fields */}
        <div className="border border-slate-200 m-5 p-4 rounded">
          <div className={label + " mb-2"}>Blerësi:</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <Label className={label}>Blerësi</Label>
              <div className="mt-1 flex gap-1">
                <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                  <SelectTrigger className={`${field} flex-1`} data-testid="sale-buyer-select">
                    <SelectValue placeholder="Zgjidh blerësin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="none">— Klient i rastit —</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={load} title="Rifresko"><RefreshCw className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Çmimorja</Label>
              <Select value={priceMode} onValueChange={setPriceMode}>
                <SelectTrigger className={field + " mt-1"} data-testid="sale-pricemode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Me pakicë</SelectItem>
                  <SelectItem value="wholesale">Me shumicë</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Mënyra pagesës</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className={field + " mt-1"} data-testid="sale-payment-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Kartë</SelectItem>
                  <SelectItem value="debt">Kredi / Borxh</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label className={label}>Data e dokumentit</Label>
              <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                className={field + " mt-1"} data-testid="sale-docdate-input" />
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Data e skadencës</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className={field + " mt-1"} data-testid="sale-duedate-input" />
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Limiti</Label>
              <Input value={Number(limit).toFixed(2)} disabled
                className="h-9 mt-1 bg-slate-100 border-slate-300 text-slate-700 text-right font-mono" data-testid="sale-limit" />
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Gjendja (borxhi aktual)</Label>
              <Input value={(balance > 0 ? -balance : Math.abs(balance)).toFixed(2)} disabled
                className={`h-9 mt-1 bg-slate-100 border-slate-300 text-right font-mono underline underline-offset-2 ${balance > 0 ? "text-red-600" : "text-slate-700"}`}
                data-testid="sale-balance" />
            </div>
            {paymentMethod === "debt" && (
              <div className="md:col-span-3">
                <Label className={label}>Paguar tani (€)</Label>
                <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)}
                  className={field + " mt-1"} placeholder="0.00" data-testid="sale-paid-input" />
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="mx-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-700">Artikujt</div>
            <Button size="sm" variant="outline" onClick={addRow} data-testid="sale-add-row-btn"><Plus className="w-3.5 h-3.5 mr-1" /> Shto rresht</Button>
          </div>
          <div className="border border-slate-300 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-300">
                  <th className="px-2 py-2 text-left w-32">Shifra</th>
                  <th className="px-2 py-2 text-left w-44">Barkodi</th>
                  <th className="px-2 py-2 text-left">Përshkrimi</th>
                  <th className="px-2 py-2 text-right w-20">Stoku</th>
                  <th className="px-2 py-2 text-left w-36">IMEI</th>
                  <th className="px-2 py-2 text-right w-20">Sasia</th>
                  <th className="px-2 py-2 text-right w-28">Çmimi</th>
                  <th className="px-2 py-2 text-right w-24">Zbritja</th>
                  <th className="px-2 py-2 text-right w-28">Totali</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prod = products.find((p) => p.id === r.product_id);
                  const availableImeis = (prod?.imeis || []).filter((x) => x.status === "in_stock");
                  return (
                    <tr key={i} className="border-b border-slate-200" data-testid={`sale-row-${i}`}>
                      <td className="px-1 py-1">
                        <Input value={r._code} placeholder="Shifra / barkod"
                          onChange={(e) => updateRow(i, { _code: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findByCode(i); } }}
                          onBlur={() => findByCode(i)}
                          className="h-8 bg-white border-slate-300 text-xs font-mono" data-testid={`sale-code-input-${i}`} />
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex gap-1">
                          <Input value={r._barcode} placeholder="Skano barkodin"
                            onChange={(e) => updateRow(i, { _barcode: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scanBarcode(i); } }}
                            className="h-8 bg-white border-slate-300 text-xs font-mono" data-testid={`sale-barcode-input-${i}`} />
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Skano me kamerë"
                            onClick={() => setScanRow(i)} data-testid={`sale-barcode-camera-${i}`}>
                            <ScanLine className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <Select value={r.product_id || "none"} onValueChange={(v) => {
                          if (v === "__new__") { setNewForRow(i); return; }
                          pickProduct(i, v === "none" ? "" : v);
                        }}>
                          <SelectTrigger className="h-8 bg-white border-slate-300" data-testid={`sale-product-${i}`}>
                            <SelectValue placeholder="Zgjidh produktin" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {isAdmin && (
                              <SelectItem value="__new__" className="text-emerald-700 font-semibold" data-testid={`sale-create-product-${i}`}>
                                + Krijo artikull të ri
                              </SelectItem>
                            )}
                            <SelectItem value="none">—</SelectItem>
                            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1 text-right font-mono text-sm pr-2">
                        <span className={prod && prod.quantity <= (prod.low_stock_threshold || 2) ? "text-red-500" : "text-slate-700"}>
                          {prod ? prod.quantity : "—"}
                        </span>
                      </td>
                      <td className="px-1 py-1">
                        {r._type === "phone" ? (
                          <>
                            <Input value={r.imei} list={`imeis-${i}`} placeholder="Shkruaj / skano IMEI"
                              onChange={(e) => updateRow(i, { imei: e.target.value })}
                              className={`h-8 bg-white border-slate-300 text-xs font-mono ${r.product_id && !r.imei ? "border-red-400" : ""}`}
                              data-testid={`sale-imei-${i}`} />
                            <datalist id={`imeis-${i}`}>
                              {availableImeis.map((x) => <option key={x.imei} value={x.imei} />)}
                            </datalist>
                          </>
                        ) : (
                          <div className="h-8 flex items-center text-xs text-slate-400 px-2">—</div>
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" value={r.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })}
                          disabled={r._type === "phone"} className="h-8 text-right bg-white border-slate-300" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.01" value={r.sale_price} onChange={(e) => updateRow(i, { sale_price: e.target.value })}
                          className="h-8 text-right bg-white border-slate-300 font-mono" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.01" value={r.discount} onChange={(e) => updateRow(i, { discount: e.target.value })}
                          className="h-8 text-right bg-white border-slate-300 font-mono" />
                      </td>
                      <td className="px-1 py-1 text-right font-mono text-sm text-slate-900 pr-2">
                        {eur(lineTotal(r))}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => removeRow(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals + notes */}
        <div className="grid md:grid-cols-2 gap-5 m-5">
          <div>
            <Label className={label}>Shënime</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={field + " mt-1"} />
          </div>
          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Nëntotali</span><span className="font-mono">{eur(subtotal)}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-300 text-lg font-bold">
                <span>TOTALI</span><span className="font-mono text-emerald-600" data-testid="sale-total">{eur(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ProductFormDialog open={newForRow !== null} onOpenChange={(o) => !o && setNewForRow(null)} onSaved={onProductCreated} />
      <BarcodeScanner open={scanRow !== null} onClose={() => setScanRow(null)}
        onDetected={(text) => { const i = scanRow; setScanRow(null); updateRow(i, { _barcode: text }); scanBarcode(i, text); }} />
    </div>
  );
}
