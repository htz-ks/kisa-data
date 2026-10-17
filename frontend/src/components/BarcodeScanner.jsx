import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

export default function BarcodeScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    const start = async () => {
      setErr("");
      setStarting(true);
      try {
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) throw new Error("Nuk u gjet asnjë kamerë");
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        if (cancelled) return;
        controlsRef.current = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current,
          (result) => {
            if (result) {
              const text = result.getText();
              if (text) {
                onDetected(text);
                stop();
              }
            }
          }
        );
      } catch (e) {
        setErr(e.message || "Nuk mund të hapet kamera");
      } finally {
        setStarting(false);
      }
    };

    const stop = () => {
      try { controlsRef.current?.stop(); } catch {}
      controlsRef.current = null;
    };

    start();
    return () => { cancelled = true; stop(); };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#141C2B] border-slate-800 max-w-md">
        <DialogHeader>
          <DialogTitle>Skano barkodin</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square rounded-lg overflow-hidden bg-black" data-testid="barcode-scanner">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-slate-200">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 border-[3px] border-emerald-400/50 rounded-lg" />
          <div className="pointer-events-none absolute left-6 right-6 top-1/2 h-[2px] bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
        </div>
        {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-2">{err}</div>}
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>Vendos barkodin brenda kornizës</span>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="scanner-close-btn">
            <X className="w-4 h-4 mr-1" /> Mbyll
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
