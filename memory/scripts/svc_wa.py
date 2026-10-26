base = "/app/frontend/src/pages/ServicesPage.jsx"
s = open(base).read()
pairs = [
    ('import { Plus, Search, Pencil, History, Printer, Trash2, Wrench } from "lucide-react";',
     'import { Plus, Search, Pencil, History, Printer, Trash2, Wrench, MessageCircle } from "lucide-react";'),
    ('import { openPdf } from "@/components/DebtLedger";', 'import { openPdf, waPhone } from "@/components/DebtLedger";'),
    ('const fmtDate = (d) => (d ? d.split("-").reverse().join(".") : "—");', '''const fmtDate = (d) => (d ? d.split("-").reverse().join(".") : "—");
// opens WhatsApp with a ready-made "your phone is ready" message for the customer
const notifyReady = (s) => {
  const lines = [
    `Përshëndetje ${s.first_name}${s.last_name ? " " + s.last_name : ""},`,
    `Telefoni juaj ${s.device} (servisi ${s.number}) është gati për t'u marrë.`,
    s.price != null ? `Çmimi i riparimit: ${Number(s.price).toFixed(2)} €.` : "",
    "HIGH TECH ZONE SH.P.K. · Rr. Henri Dunan nr. 6 · 044 104 605",
  ].filter(Boolean);
  window.open(`https://wa.me/${waPhone(s.phone)}?text=${encodeURIComponent(lines.join("\\n"))}`, "_blank", "noopener");
};'''),
    ('''                    <button onClick={() => openPdf(`/services/${s.id}/receipt.pdf`)}''',
     '''                    <button onClick={() => notifyReady(s)} className={`p-1.5 hover:text-green-600 ${s.status === "repaired" ? "text-green-600" : "text-slate-500"}`} title="Njofto klientin në WhatsApp që telefoni është gati" data-testid={`service-whatsapp-${s.id}`}><MessageCircle className="w-4 h-4" /></button>
                    <button onClick={() => openPdf(`/services/${s.id}/receipt.pdf`)}'''),
    ('''  const onStatus = (s, v) => (v === "delivered" ? setDeliver(s) : setStatus(s, v));''',
     '''  const onStatus = async (s, v) => {
    if (v === "delivered") return setDeliver(s);
    await setStatus(s, v);
    if (v === "repaired" && window.confirm("Telefoni është gati. Ta njoftoj klientin në WhatsApp?")) notifyReady(s);
  };'''),
]
for a, b in pairs:
    assert a in s, a[:60]
    s = s.replace(a, b, 1)
open(base, "w").write(s)
print("ok")
