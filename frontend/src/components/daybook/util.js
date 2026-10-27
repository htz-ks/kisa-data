import api from "@/lib/api";
import { toast } from "sonner";

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayLocal = () => ymd(new Date());
export const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const DENOMS = ["500", "200", "100", "50", "20", "10", "5", "2", "1", "0.5", "0.2", "0.1"];
export const inp = "bg-slate-900 border-slate-800";

export const TYPE_STYLE = {
  "Shitje": "bg-emerald-100 text-emerald-800",
  "Blerje": "bg-violet-100 text-violet-800",
  "Shpenzim": "bg-rose-100 text-rose-800",
  "Kthim": "bg-amber-100 text-amber-800",
  "Arkëtim borxhi": "bg-sky-100 text-sky-800",
  "Pagesë furnitori": "bg-indigo-100 text-indigo-800",
  "Servis": "bg-cyan-100 text-cyan-800",
  "Kthim servisi": "bg-amber-100 text-amber-800",
  "Hyrje manuale": "bg-teal-100 text-teal-800",
  "Dalje manuale": "bg-orange-100 text-orange-800",
};

export const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const download = async (path, filename) => {
  try {
    const { data } = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch { toast.error("Skedari nuk u krijua"); }
};
