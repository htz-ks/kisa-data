import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesPage() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);

  const load = async () => { const { data } = await api.get("/categories"); setList(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editId) await api.put(`/categories/${editId}`, { name });
      else await api.post("/categories", { name });
      toast.success("U ruajt");
      setOpen(false); setName(""); setEditId(null);
      await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Fshi?")) return; await api.delete(`/categories/${id}`); await load(); };

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Kategoritë" subtitle="Organizo produktet në kategori"
        action={<Button onClick={() => { setEditId(null); setName(""); setOpen(true); }} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="category-create-btn"><Plus className="w-4 h-4 mr-1" /> Shto kategori</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {list.map((c) => (
          <div key={c.id} className="stat-card p-4 flex items-center justify-between" data-testid={`category-${c.id}`}>
            <div className="font-semibold">{c.name}</div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setEditId(c.id); setName(c.name); setOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400" onClick={() => del(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full text-slate-500 text-sm text-center py-10">Pa kategori.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141C2B] border-slate-800">
          <DialogHeader><DialogTitle>{editId ? "Edito" : "Shto"} kategori</DialogTitle></DialogHeader>
          <div><Label>Emri</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-slate-900 border-slate-800" data-testid="category-name-input" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="category-save-btn">Ruaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
