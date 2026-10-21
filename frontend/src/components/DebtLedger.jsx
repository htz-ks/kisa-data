import { Button } from "@/components/ui/button";
import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { FileText, MessageCircle, Loader2 } from "lucide-react";

// Kosovo local numbers (044..., 049...) -> international 38344... required by WhatsApp
export const waPhone = (raw) => {
  let d = (raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "383" + d.slice(1);
  return d;
};

// Share the statement as a picture only (no text)
export const shareImage = async (path, customer, phone) => {
  const { data } = await api.get(path, { responseType: "blob" });
  const file = new File([data], `borxhi-${(customer.name || "klient").replace(/[^a-zA-Z0-9]/g, "")}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== "AbortError") throw e; }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast.success("Fotoja u shkarkua — bashkëngjite te biseda e WhatsApp që u hap");
  window.open(`https://wa.me/${phone}`, "_blank", "noopener");
};

// fetch with auth (token header) and open the PDF in a new tab
export const openPdf = async (path) => {
  const win = window.open("", "_blank");
  try {
    const { data } = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    if (win) win.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    if (win) win.close();
    toast.error("PDF nuk u hap, provo përsëri");
  }
};

export const DebtActions = ({ customer, pdfPath, compact = false }) => {
  const phone = waPhone(customer.phone);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await shareImage(pdfPath.replace(/\.pdf$/, ".png"), customer, phone); }
    catch { toast.error("Fotoja nuk u krijua, provo përsëri"); }
    finally { setBusy(false); }
  };
  if (compact) return (
    <div className="flex gap-2 justify-end">
      <Button size="sm" onClick={send} disabled={busy} className="bg-[#25D366] hover:bg-[#1ebe5a] text-white font-semibold" data-testid={`card-whatsapp-${customer.id}`}>
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-1" />} WhatsApp
      </Button>
      <Button size="sm" onClick={() => openPdf(pdfPath)} className="bg-sky-600 hover:bg-sky-500 text-white font-semibold" data-testid={`card-pdf-${customer.id}`}>
        <FileText className="w-4 h-4 mr-1" /> PDF A4
      </Button>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={send} disabled={busy} className="h-16 text-lg font-bold bg-[#25D366] hover:bg-[#1ebe5a] text-white" data-testid="debt-whatsapp-btn">
          {busy ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <MessageCircle className="w-6 h-6 mr-2" />} WhatsApp
        </Button>
        <Button onClick={() => openPdf(pdfPath)} className="h-16 text-lg font-bold bg-sky-600 hover:bg-sky-500 text-white" data-testid="debt-pdf-btn">
          <FileText className="w-6 h-6 mr-2" /> PDF A4
        </Button>
      </div>
      {!phone && <div className="text-xs text-amber-400">Klienti nuk ka numër telefoni.</div>}
    </div>
  );
};
