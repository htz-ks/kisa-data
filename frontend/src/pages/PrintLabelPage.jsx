import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Barcode from "react-barcode";
import api from "@/lib/api";

/**
 * Prints 1..N copies of a product's price label.
 * Label format (50mm x 30mm):
 *   [name]
 *   [shifra] [barcode] [cost reversed]
 *   [price]
 *
 * Access: /print/label/:id?copies=4
 */
export default function PrintLabelPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const copies = Math.max(1, Math.min(50, parseInt(sp.get("copies") || "1", 10)));
  const [p, setP] = useState(null);

  useEffect(() => { api.get(`/products/${id}`).then(({ data }) => setP(data)); }, [id]);
  useEffect(() => { if (p) setTimeout(() => window.print(), 500); }, [p]);

  if (!p) return <div style={{ padding: 20 }}>Duke ngarkuar…</div>;

  // Reverse cost price (integer euros): 50 -> "05", 1200 -> "0021"
  const costInt = Math.round(Number(p.cost_price || 0)).toString();
  const costReversed = costInt.split("").reverse().join("");

  const barcodeValue = p.barcode || p.code || p.id.slice(-10);

  const labels = Array.from({ length: copies });

  return (
    <div>
      <style>{`
        @page { size: 50mm 30mm; margin: 0; }
        body { margin: 0; font-family: Arial, sans-serif; color: #000; }
        .page-wrap { padding: 10px; }
        .label {
          width: 50mm; height: 30mm;
          padding: 2mm 3mm; box-sizing: border-box;
          border: 1px solid #000; margin: 0 0 1mm 0; page-break-inside: avoid;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .name { font-size: 11px; font-weight: 700; line-height: 1.1; overflow: hidden; max-height: 24px; }
        .mid { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
        .code { font-size: 8px; font-family: monospace; }
        .cost-rev { font-size: 8px; font-family: monospace; letter-spacing: 1px; }
        .price { text-align: center; font-size: 15px; font-weight: 800; font-family: monospace; }
        .barcode-wrap svg { width: 36mm; height: 10mm; }
        @media print { .no-print { display: none !important; } .label { margin: 0; } }
      `}</style>
      <div className="no-print" style={{ padding: 10, background: "#eee", display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ padding: "6px 10px" }}>Printo {copies} etiketa</button>
        <button onClick={() => window.close()} style={{ padding: "6px 10px" }}>Mbyll</button>
        <span style={{ fontSize: 12, marginLeft: 10 }}>Produkti: <b>{p.name}</b> · Shifra: {p.code || "—"}</span>
      </div>

      <div className="page-wrap">
        {labels.map((_, i) => (
          <div key={i} className="label">
            <div className="name">
              {p.brand ? <span style={{ color: "#555", fontWeight: 400 }}>{p.brand} </span> : null}
              {p.name}
            </div>
            {(p.gb || p.ram || p.battery_percent) && (
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "#111", display: "flex", gap: 6, justifyContent: "center" }}>
                {p.gb && <span><b>{p.gb}</b>GB</span>}
                {p.ram && <span>RAM <b>{p.ram}</b></span>}
                {p.battery_percent && <span>Bat <b>{p.battery_percent}%</b></span>}
              </div>
            )}
            <div className="barcode-wrap" style={{ textAlign: "center" }}>
              <Barcode value={barcodeValue} format="CODE128" displayValue={true} fontSize={8} height={24} margin={0} />
            </div>
            <div className="mid">
              <span className="code">{p.code || "—"}</span>
              <span className="cost-rev">{costReversed}</span>
            </div>
            <div className="price">€ {Number(p.sale_price || 0).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
