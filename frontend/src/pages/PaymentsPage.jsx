import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ entity_type: "customer", entity_id: "", amount: 0, direction: "in", notes: "" });

  const load = async () => {
    const [p, c, s] = await Promise.all([api.get("/payments"), api.get("/customers"), api.get("/suppliers")]);
    setPayments(p.data); setCustomers(c.data); setSuppliers(s.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/payments", { ...form, amount: Number(form.amount) || 0 });
      toast.success("Pagesa u ruajt");
      setOpen(false);
      setForm({ entity_type: "customer", entity_id: "", amount: 0, direction: "in", notes: "" });
      await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const nameFor = (p) => {
    const arr = p.entity_type === "customer" ? customers : suppliers;
    return arr.find((x) => x.id === p.entity_id)?.name || "—";
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Pagesa & Borxhe" subtitle="Shlyerje borxhesh me klientë dhe furnitorë"
        action={<Button onClick={() => setOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="payment-create-btn">Shto Pagesë</Button>} />

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="stat-card">
          <div className="text-xs uppercase font-mono-pd text-slate-500 tracking-widest">Borxh klientësh</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-2">{eur(customers.reduce((s, c) => s + (c.balance || 0), 0))}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase font-mono-pd text-slate-500 tracking-widest">Borxh furnitorësh</div>
          <div className="text-2xl font-extrabold text-red-400 mt-2">{eur(suppliers.reduce((s, c) => s + (c.balance || 0), 0))}</div>
        </div>
      </div>

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Lloji</th><th className="px-4 py-3">Kujt</th><th className="px-4 py-3">Drejtimi</th><th className="px-4 py-3 text-right">Shuma</th><th className="px-4 py-3">Shënim</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50">
                <td className="px-4 py-3 font-mono-pd text-xs text-slate-400">{(p.created_at || "").slice(0, 10)}</td>
                <td className="px-4 py-3">{p.entity_type === "customer" ? "Klient" : "Furnitor"}</td>
                <td className="px-4 py-3">{nameFor(p)}</td>
                <td className="px-4 py-3">{p.direction === "in" ? <span className="text-emerald-400">Hyrje</span> : <span className="text-red-400">Dalje</span>}</td>
                <td className="px-4 py-3 text-right font-mono-pd font-semibold">{eur(p.amount)}</td>
                <td className="px-4 py-3 text-slate-400">{p.notes || "—"}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Pa pagesa.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141C2B] border-slate-800">
          <DialogHeader><DialogTitle>Pagesë e re</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Lloji</Label>
              <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v, entity_id: "", direction: v === "customer" ? "in" : "out" })}>
                <SelectTrigger className="mt-1 bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="customer">Klient (merr pagesë)</SelectItem><SelectItem value="supplier">Furnitor (bëj pagesë)</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zgjidh</Label>
              <Select value={form.entity_id || "none"} onValueChange={(v) => setForm({ ...form, entity_id: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1 bg-slate-900 border-slate-800" data-testid="payment-entity-select"><SelectValue placeholder="Zgjidh" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {(form.entity_type === "customer" ? customers : suppliers).map((x) => <SelectItem key={x.id} value={x.id}>{x.name} ({eur(x.balance || 0)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shuma (€)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="payment-amount-input" />
            </div>
            <div>
              <Label>Shënime</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="payment-save-btn">Ruaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
