import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { email: "", password: "", name: "", role: "employee", daily_target: 0, commission_percent: 0 };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => { const { data } = await api.get("/users"); setUsers(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/users", { ...form, daily_target: Number(form.daily_target) || 0, commission_percent: Number(form.commission_percent) || 0 });
      toast.success("Përdoruesi u shtua");
      setOpen(false); setForm(EMPTY);
      await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const del = async (id) => { if (!window.confirm("Fshi?")) return; try { await api.delete(`/users/${id}`); await load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Përdoruesit" subtitle="Admin dhe punonjës"
        action={<Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="user-create-btn"><Plus className="w-4 h-4 mr-1" /> Shto</Button>} />

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr><th className="px-4 py-3">Emri</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Roli</th><th className="px-4 py-3 text-right">Target ditor</th><th className="px-4 py-3 text-right">Komision %</th><th className="px-4 py-3 text-right">Veprime</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-800/50" data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 font-mono-pd text-slate-300">{u.email}</td>
                <td className="px-4 py-3"><Badge variant="outline" className={u.role === "admin" ? "border-emerald-500/40 text-emerald-300" : "border-indigo-500/40 text-indigo-300"}>{u.role}</Badge></td>
                <td className="px-4 py-3 text-right font-mono-pd text-slate-300">€ {Number(u.daily_target || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-slate-300">{Number(u.commission_percent || 0).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => del(u.id)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141C2B] border-slate-800">
          <DialogHeader><DialogTitle>Shto përdorues</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Emri</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="user-name-input" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="user-email-input" /></div>
            <div><Label>Fjalëkalimi</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="user-password-input" /></div>
            <div><Label>Roli</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1 bg-slate-900 border-slate-800" data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="employee">Punonjës</SelectItem></SelectContent>
              </Select>
            </div>
            {form.role === "employee" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target ditor (€)</Label>
                  <Input type="number" step="0.01" value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="user-target-input" />
                </div>
                <div>
                  <Label>Komision %</Label>
                  <Input type="number" step="0.1" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} className="mt-1 bg-slate-900 border-slate-800" data-testid="user-commission-input" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="user-save-btn">Ruaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
