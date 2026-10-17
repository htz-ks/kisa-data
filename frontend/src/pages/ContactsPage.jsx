import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import CustomerHistoryDrawer from "@/components/CustomerHistoryDrawer";

const EMPTY = { name: "", phone: "", email: "", address: "", notes: "" };

export default function ContactsPage({ kind }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const endpoint = kind === "customer" ? "/customers" : "/suppliers";
  const title = kind === "customer" ? "Klientët" : "Furnitorët";
  const subtitle = kind === "customer" ? "Lista e klientëve dhe borxhet e tyre" : "Lista e furnitorëve dhe borxhet e tyre";

  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [historyId, setHistoryId] = useState(null);

  const load = async () => {
    const { data } = await api.get(endpoint);
    setList(data);
  };
  useEffect(() => { load(); }, [kind]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", notes: c.notes || "" }); setEditId(c.id); setOpen(true); };

  const save = async () => {
    try {
      if (editId) await api.put(`${endpoint}/${editId}`, form);
      else await api.post(endpoint, form);
      toast.success("U ruajt");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };
  const del = async (id) => {
    if (!window.confirm("Fshi?")) return;
    try { await api.delete(`${endpoint}/${id}`); toast.success("U fshi"); await load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const canCreate = kind === "customer" ? true : isAdmin;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title={title} subtitle={subtitle}
        action={canCreate && (
          <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid={`${kind}-create-btn`}>
            <Plus className="w-4 h-4 mr-1" /> Shto
          </Button>
        )} />

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Emri</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Borxh (€)</th>
              {(isAdmin || kind === "customer") && <th className="px-4 py-3 text-right">Veprime</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`${kind}-row-${c.id}`}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-slate-300 font-mono-pd">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{c.email || "—"}</td>
                <td className="px-4 py-3 text-right font-mono-pd">
                  <span className={c.balance > 0 ? "text-amber-400" : "text-slate-500"}>{eur(c.balance || 0)}</span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    {kind === "customer" && (
                      <Button variant="ghost" size="sm" onClick={() => setHistoryId(c.id)} className="text-indigo-300" data-testid={`customer-history-${c.id}`}>
                        <History className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del(c.id)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                )}
                {!isAdmin && kind === "customer" && (
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setHistoryId(c.id)} className="text-indigo-300" data-testid={`customer-history-${c.id}`}>
                      <History className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={isAdmin ? 5 : (kind === "customer" ? 5 : 4)} className="px-4 py-10 text-center text-slate-500">Pa të dhëna.</td></tr>}
          </tbody>
        </table>
      </div>

      {kind === "customer" && <CustomerHistoryDrawer customerId={historyId} onClose={() => setHistoryId(null)} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141C2B] border-slate-800">
          <DialogHeader><DialogTitle>{editId ? "Edito" : "Shto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Emri *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid={`${kind}-name-input`} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" /></div>
            <div><Label>Adresa</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid={`${kind}-save-btn`}>Ruaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
