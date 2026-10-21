import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ACTIONS = { create: "Krijuar", update: "Ndryshuar", correct: "Korrigjuar", restore: "Kthyer origjinali", delete: "Fshirë" };
const show = (v) => (v == null ? "—" : typeof v === "object" ? Object.entries(v).filter(([, x]) => x != null && x !== "").map(([k, x]) => `${k}: ${x}`).join(", ") : String(v));

export const AuditDialog = ({ auditKey, onClose }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (auditKey === null) return;
    api.get("/daybook/audit", { params: auditKey ? { key: auditKey } : {} }).then(({ data }) => setRows(data));
  }, [auditKey]);
  return (
    <Dialog open={auditKey !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-[#141C2B] border-slate-800 text-slate-100 max-h-[85vh] overflow-y-auto" data-testid="audit-dialog">
        <DialogHeader><DialogTitle>Historiku i korrigjimeve</DialogTitle></DialogHeader>
        <table className="w-full text-xs">
          <thead className="text-left uppercase text-slate-500 border-b border-slate-800">
            <tr><th className="py-2">Data & ora</th><th>Përdoruesi</th><th>Veprimi</th><th>Para</th><th>Pas</th><th>Arsyeja</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/50 align-top" data-testid={`audit-row-${r.id}`}>
                <td className="py-2 font-mono-pd whitespace-nowrap">{new Date(r.at).toLocaleString("sq-AL")}</td>
                <td>{r.user_name}</td><td>{ACTIONS[r.action] || r.action}</td>
                <td className="text-slate-400 max-w-[180px] break-words">{show(r.before)}</td>
                <td className="max-w-[180px] break-words">{show(r.after)}</td><td>{r.reason || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Asnjë ndryshim.</td></tr>}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
};
