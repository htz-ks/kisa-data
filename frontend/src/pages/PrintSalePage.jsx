import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { COMPANY } from "@/lib/company";

/**
 * Print-only page. Query ?format=a4 | 80 | 58
 * Auto triggers window.print() on mount.
 */
export default function PrintSalePage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const format = sp.get("format") || "a4";
  const [sale, setSale] = useState(null);

  useEffect(() => {
    api.get(`/sales/${id}`).then(({ data }) => setSale(data));
  }, [id]);

  useEffect(() => {
    if (sale) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [sale]);

  if (!sale) return <div style={{ padding: 20 }}>Duke ngarkuar…</div>;

  const dateStr = (sale.created_at || "").slice(0, 19).replace("T", " ");

  const pageCSS = {
    a4: "@page { size: A4; margin: 10mm; } body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color:#111; }",
    80: "@page { size: 80mm auto; margin: 3mm; } body { font-family: Arial, sans-serif; color:#000; width: 72mm; font-size: 11px; }",
    58: "@page { size: 58mm auto; margin: 2mm; } body { font-family: Arial, sans-serif; color:#000; width: 54mm; font-size: 10px; }",
  }[format] || "";
  const baseCSS = "html, body { background:#fff !important; color:#111 !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }";

  const narrow = format !== "a4";

  if (narrow) {
    return (
      <div style={{ padding: 0 }}>
        <style>{`
          ${baseCSS}
        ${pageCSS}
          * { box-sizing: border-box; }
          .row { display:flex; justify-content:space-between; }
          .center { text-align:center; }
          .b { font-weight:700; }
          .hr { border-top:1px dashed #000; margin:4px 0; }
          table { width:100%; border-collapse:collapse; }
          td,th { padding:2px 0; text-align:left; vertical-align:top; }
          .r { text-align:right; }
          @media print { .no-print { display:none !important; } }
        `}</style>
        <div className="no-print" style={{ padding: 8, display: "flex", gap: 8, background: "#eee" }}>
          <button onClick={() => window.print()} style={{ padding: "6px 10px" }}>Printo</button>
          <button onClick={() => window.close()} style={{ padding: "6px 10px" }}>Mbyll</button>
          <span style={{ fontSize: 11 }}>Format: {format}mm</span>
        </div>
        <div className="center"><img src={COMPANY.logo} alt="logo" style={{ width: "70%", maxWidth: 220 }} /></div>
        <div className="center b" style={{ fontSize: 12, marginTop: 4 }}>{COMPANY.name}</div>
        <div className="center" style={{ fontSize: 9 }}>{COMPANY.address} · NUI {COMPANY.nui}</div>
        <div className="center" style={{ fontSize: 9 }}>Tel {COMPANY.phone} · {COMPANY.email}</div>
        <div className="center" style={{ fontSize: 10, marginTop: 4 }}>Faturë Shitjeje</div>
        <div className="hr" />
        <div className="row"><span>Nr.</span><span className="b">{sale.invoice_no}</span></div>
        <div className="row"><span>Data</span><span>{dateStr}</span></div>
        <div className="row"><span>Klienti</span><span>{sale.customer_name || "Qytetar"}</span></div>
        <div className="row"><span>Pagesa</span><span>{(sale.payment_method || "").toUpperCase()}</span></div>
        <div className="hr" />
        <table>
          <thead>
            <tr><th>Produkti</th><th className="r">Sas.</th><th className="r">Çm.</th><th className="r">Tot.</th></tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={i}>
                <td>
                  {it.product_name}
                  {(it.product_code || it.barcode) && <div style={{ fontSize: 9 }}>{[it.product_code, it.barcode].filter(Boolean).join(" · ")}</div>}
                  {it.imei && <div style={{ fontSize: 9 }}>IMEI: {it.imei}</div>}
                  {it.warranty_until && <div style={{ fontSize: 9 }}>Gar.{it.warranty_label ? ` ${it.warranty_label}` : ""}: {(it.warranty_until || "").slice(0,10)}</div>}
                </td>
                <td className="r">{it.quantity}</td>
                <td className="r">{Number(it.sale_price).toFixed(2)}</td>
                <td className="r">{Number(it.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hr" />
        <div className="row"><span>Nëntotali</span><span>€ {sale.subtotal.toFixed(2)}</span></div>
        <div className="row"><span>Zbritja</span><span>€ {sale.discount.toFixed(2)}</span></div>
        <div className="row b" style={{ fontSize: 13 }}><span>TOTALI</span><span>€ {sale.total.toFixed(2)}</span></div>
        <div className="row"><span>Paguar</span><span>€ {sale.paid_amount.toFixed(2)}</span></div>
        {sale.due_amount > 0 && <div className="row b"><span>Borxh</span><span>€ {sale.due_amount.toFixed(2)}</span></div>}
        <div className="hr" />
        <div className="center" style={{ fontSize: 10 }}>Faleminderit për blerjen!</div>
        <div className="center" style={{ fontSize: 9, marginTop: 8 }}>{COMPANY.name} · {new Date().toLocaleDateString()}</div>
      </div>
    );
  }

  // A4 full invoice
  return (
    <div>
      <style>{`
        ${baseCSS}
        ${pageCSS}
        * { box-sizing: border-box; }
        .wrap { max-width: 190mm; margin: 0 auto; padding: 0; }
        .brand { color:#10B981; font-size: 34px; font-weight: 800; letter-spacing: -0.02em; }
        .muted { color:#64748B; font-size: 14px; }
        .company { font-size: 12px; color: #334155; line-height: 1.35; }
        .company .cname { font-weight: 800; font-size: 14px; color: #0B0F17; margin-top: 4px; }
        .box { border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px; font-size: 15px; }
        table { width:100%; border-collapse: collapse; margin-top: 16px; font-size: 15px; }
        th { background:#0B0F17; color:#fff; padding:9px 8px; text-align:left; font-size: 14px; white-space: nowrap; }
        td { padding: 8px; border-bottom:1px solid #E2E8F0; vertical-align: top; }
        .r { text-align:right; }
        .totals { margin-top:10px; margin-left:auto; width: 85mm; }
        .totals .row { display:flex; justify-content:space-between; padding: 3px 0; font-size: 17px; }
        .totals .big { font-weight:800; font-size: 22px; color:#10B981; border-top:1px solid #E2E8F0; padding-top:6px; }
        .terms { margin-top: 10px; border-top: 1px solid #CBD5E1; padding-top: 4px; font-size: 11px; line-height: 1.3; color: #1E293B; }
        .terms .th { font-weight: 800; font-size: 13px; margin-top: 5px; }
        .terms .sign { display:flex; justify-content:space-between; margin-top: 12px; font-size: 15px; }
        .terms .sign span { display:inline-block; margin-top: 18px; color:#475569; }
        @media print { .no-print { display:none !important; } html, body, #root, #root > div { min-height: 0 !important; height: auto !important; } }
      `}</style>
      <div className="no-print" style={{ padding: 10, background: "#eee", display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ padding: "8px 14px" }}>Printo A4</button>
        <button onClick={() => (window.opener ? window.close() : navigate("/sales"))} style={{ padding: "8px 14px" }}>Mbyll</button>
      </div>
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 }}>
          <div className="company">
            <img src={COMPANY.logo} alt="HITECHZONE" style={{ height: 50 }} />
            <div className="cname">{COMPANY.name}</div>
            <div>{COMPANY.address} · NUI: {COMPANY.nui}</div>
            <div>Tel: {COMPANY.phone} · {COMPANY.email}</div>
          </div>
          <div className="box" style={{ flex: 1, margin: "0 12px" }}>
            <div style={{ fontSize: 13, color: "#64748B" }}>Klienti</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{sale.customer_name || "Qytetar"}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Shitësi: {sale.created_by_name || "—"}</div>
          </div>
          <div className="box" style={{ minWidth: 200 }}>
            <div style={{ fontSize: 13, color: "#64748B" }}>Nr. Faturës</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{sale.invoice_no}</div>
            <div style={{ fontSize: 13, marginTop: 6, color: "#64748B" }}>Data: {dateStr}</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Pagesa: {(sale.payment_method || "").toUpperCase()}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Shifra</th><th>Barkodi</th><th>Përshkrimi</th><th>IMEI / Garanci</th>
              <th className="r">Sasia</th><th className="r">Çmimi (€)</th><th className="r">Totali (€)</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={i}>
                <td style={{ fontFamily: "monospace", fontSize: 13 }}>{it.product_code || "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 13 }}>{it.barcode || "—"}</td>
                <td>{it.product_name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 13 }}>
                  {it.imei || "—"}
                  {it.warranty_until && <div style={{ color: "#059669", fontSize: 11, whiteSpace: "nowrap" }}>Garanci{it.warranty_label ? ` ${it.warranty_label}` : ""} deri: {(it.warranty_until || "").slice(0,10)}</div>}
                </td>
                <td className="r">{it.quantity}</td>
                <td className="r">{Number(it.sale_price).toFixed(2)}</td>
                <td className="r">{Number(it.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals">
          <div className="row"><span>Nëntotali</span><span>€ {sale.subtotal.toFixed(2)}</span></div>
          <div className="row"><span>Zbritja</span><span>€ {sale.discount.toFixed(2)}</span></div>
          <div className="row big"><span>TOTALI</span><span>€ {sale.total.toFixed(2)}</span></div>
          <div className="row"><span>Paguar</span><span>€ {sale.paid_amount.toFixed(2)}</span></div>
          {sale.due_amount > 0 && <div className="row" style={{ color: "#D97706", fontWeight: 700 }}><span>Mbetur</span><span>€ {sale.due_amount.toFixed(2)}</span></div>}
        </div>
        {sale.warranty_terms && (
          <div className="terms" data-testid="print-warranty-terms">
            {sale.warranty_terms.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              const heading = t === t.toUpperCase() && /[A-ZËÇ]/.test(t);
              return <div key={i} className={heading ? "th" : ""}>{t}</div>;
            })}
            <div className="sign">
              <div>Shitësi<br /><span>_______________________</span></div>
              <div>Blerësi<br /><span>_______________________</span></div>
            </div>
          </div>
        )}
        {!sale.warranty_terms && (
          <div style={{ marginTop: 40, fontSize: 12, color: "#64748B", textAlign: "center" }}>
            Faleminderit për blerjen! — {COMPANY.name}
          </div>
        )}
      </div>
    </div>
  );
}
