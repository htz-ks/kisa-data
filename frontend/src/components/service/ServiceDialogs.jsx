import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const STATUSES = [
  { v: "pending", l: "Në pritje", c: "bg-slate-200 text-slate-800" },
  { v: "repairing", l: "Në riparim", c: "bg-amber-100 text-amber-800" },
  { v: "repaired", l: "I riparuar", c: "bg-sky-100 text-sky-800" },
  { v: "delivered", l: "I dorëzuar klientit", c: "bg-emerald-100 text-emerald-800" },
];
export const statusOf = (v) => STATUSES.find((s) => s.v === v) || STATUSES[0];

export const DeliverDialog = ({ service, onClose, onConfirm }) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  useEffect(() => { if (service) { setAmount(service.price != null ? String(service.price) : ""); setMethod("cash"); } }, [service]);
  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#141C2B] border-slate-800 text-slate-100" data-testid="service-deliver-dialog">
        <DialogHeader><DialogTitle>Dorëzo telefonin · {service?.number}</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-400">{service?.device} · {service?.first_name} {service?.last_name}</p>
        <div>
          <Label>Sa pagoi klienti (€)</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0 nëse falas"
            className="mt-1 bg-slate-900 border-slate-800" data-testid="service-deliver-amount" />
        </div>
        <div>
          <Label>Pagesa</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="mt-1 bg-slate-900 border-slate-800" data-testid="service-deliver-method"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bankë</SelectItem></SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-slate-500">Paraja hyn në arkë dhe në fitim sot, te Qarkullimet Ditore (kategoria Servis).</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Anulo</Button>
          <Button onClick={() => onConfirm(Number(amount) || 0, method)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="service-deliver-confirm">Dorëzo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const show = (v) => (v == null || v === "" ? "—" : String(v));

export const ServiceHistoryDialog = ({ service, onClose }) => (
  <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-2xl bg-[#141C2B] border-slate-800 text-slate-100 max-h-[85vh] overflow-y-auto" data-testid="service-history-dialog">
      <DialogHeader><DialogTitle>Historiku · {service?.number}</DialogTitle></DialogHeader>
      <div className="space-y-2">
        {[...(service?.history || [])].reverse().map((h, i) => (
          <div key={i} className="border border-slate-800 rounded-lg p-3 text-sm" data-testid={`service-history-item-${i}`}>
            <div className="flex justify-between gap-2"><b>{h.action}</b><span className="text-xs text-slate-500 font-mono-pd">{new Date(h.at).toLocaleString("sq-AL")} · {h.user}</span></div>
            {Object.entries(h.changes || {}).map(([k, [a, b]]) => (
              <div key={k} className="text-xs text-slate-400 mt-1">{k}: <span className="line-through">{show(a)}</span> → <span className="text-slate-200">{show(b)}</span></div>
            ))}
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
