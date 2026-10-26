import { useNavigate } from "react-router-dom";
import { eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { statusOf } from "@/components/service/ServiceDialogs";

// services received on the selected day + money actually collected from repairs that day
export const ServicesBox = ({ data }) => {
  const nav = useNavigate();
  const list = data.services_received || [];
  const s = data.summary;
  return (
    <div className="stat-card p-4" data-testid="daybook-services">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2"><Wrench className="w-5 h-5 text-emerald-600" /><h2 className="font-extrabold text-lg">Servis / Shërbimi</h2></div>
        <Button size="sm" variant="outline" onClick={() => nav("/services")} data-testid="daybook-open-services">Hap Servisin</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {[["Pranuar sot", list.length, "services-received-count"], ["Dorëzuar & paguar sot", s.service_delivered, "services-delivered-count"],
          ["Arkëtuar nga servisi", eur(s.service_income), "services-income"], ["Fitimi nga servisi", eur(s.service_profit), "services-profit"]].map(([l, v, t]) => (
          <div key={t} className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">{l}</div>
            <div className="text-xl font-extrabold font-mono-pd" data-testid={t}>{v}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-800">
            <tr><th className="py-2 px-2">Nr.</th><th className="px-2">Klienti</th><th className="px-2">Telefoni</th><th className="px-2">Pajisja</th><th className="px-2">Defekti</th><th className="px-2 text-right">Çmimi</th><th className="px-2">Statusi</th></tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} className="border-b border-slate-800/40" data-testid={`daybook-service-${x.id}`}>
                <td className="py-1.5 px-2 font-mono-pd">{x.number}</td><td className="px-2 font-semibold whitespace-nowrap">{x.name}</td>
                <td className="px-2 font-mono-pd">{x.phone}</td><td className="px-2">{x.device}</td><td className="px-2 text-slate-600">{x.defect}</td>
                <td className="px-2 text-right font-mono-pd whitespace-nowrap">{x.price != null ? eur(x.price) : "—"}</td>
                <td className="px-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusOf(x.status).c}`}>{statusOf(x.status).l}</span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Asnjë telefon i pranuar në servis këtë ditë.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">Çmimi i shënuar në pranim nuk llogaritet si e ardhur; paraja hyn në arkë vetëm kur klienti e merr telefonin dhe paguan.</p>
    </div>
  );
};
