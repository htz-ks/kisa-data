import { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// Warranty terms printed on the A4 invoice (retail sales with a warranty only)
export const WarrantyTermsBox = ({ terms, setTerms, retail, hasWarranty, isAdmin }) => {
  const [open, setOpen] = useState(false);
  const active = retail && hasWarranty;

  const saveDefault = async () => {
    try {
      await api.put("/settings/warranty-terms", { text: terms });
      toast.success("Kushtet e garancionit u ruajtën");
    } catch {
      toast.error("Kushtet nuk u ruajtën");
    }
  };

  return (
    <div className="mt-3 border border-slate-200 rounded" data-testid="warranty-terms-box">
      <button type="button" onClick={() => setOpen(!open)} data-testid="warranty-terms-toggle"
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <ShieldCheck className={`w-4 h-4 ${active ? "text-emerald-600" : "text-slate-400"}`} /> Kushtet e garancionit
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className={active ? "text-emerald-600 font-semibold" : "text-slate-400"} data-testid="warranty-terms-status">
            {!retail ? "Nuk printohen (shitje me shumicë)" : !hasWarranty ? "Nuk printohen (pa garanci)" : "Printohen në A4"}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={8}
            className="text-xs bg-slate-50 border-slate-300 text-slate-900" data-testid="warranty-terms-text" />
          {isAdmin && (
            <Button type="button" size="sm" variant="outline" onClick={saveDefault} className="mt-2" data-testid="warranty-terms-save">
              Ruaj si tekst i përhershëm
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
