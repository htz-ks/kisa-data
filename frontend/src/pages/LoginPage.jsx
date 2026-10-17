import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiErrorDetail } from "@/lib/api";
import { Smartphone, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@prodata.al");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (user && user !== false) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#0B0F17]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="relative z-10 p-16 flex flex-col justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">PRODATA</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
              Menaxho stokun<br />
              <span className="text-emerald-400">pa stres.</span>
            </h1>
            <p className="text-slate-400 max-w-md text-base">
              Programi i plotë për dyqane telefonash dhe aksesorësh — IMEI, faturim, borxhe, raporte.
            </p>
            <div className="flex gap-6 pt-4 font-mono-pd text-xs uppercase tracking-widest text-slate-500">
              <span>· POS i shpejtë</span>
              <span>· IMEI unik</span>
              <span>· PDF Faturë</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono-pd">v1.0 · Made for Kosovo & Shqipëri</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-[#0B0F17]">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-2xl font-extrabold">PRODATA</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">Mirë se vjen</h2>
          <p className="text-slate-400 mb-8 text-sm">Hyr në panelin tënd për të vazhduar.</p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-slate-900 border-slate-700 h-11" data-testid="login-email-input" required />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300">Fjalëkalimi</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-slate-900 border-slate-700 h-11" data-testid="login-password-input" required />
            </div>
            {err && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2" data-testid="login-error">
                {err}
              </div>
            )}
            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold"
              data-testid="login-submit-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hyr"}
            </Button>
            <div className="text-xs text-slate-500 pt-4 border-t border-slate-800 mt-6">
              Admin test: <span className="font-mono-pd text-slate-400">admin@prodata.al / admin123</span><br/>
              Punonjës: <span className="font-mono-pd text-slate-400">punonjes@prodata.al / punonjes123</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
