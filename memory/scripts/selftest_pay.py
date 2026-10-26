import json
import urllib.request

B = "http://localhost:8002/api"


def call(method, path, body=None, token=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


_, d = call("POST", "/auth/login", {"email": "admin@prodata.al", "password": "admin123"})
T = d.get("token") or d.get("access_token")
st, p = call("POST", "/products", {"name": "SELFTEST acc", "type": "accessory", "cost_price": 100, "sale_price": 500, "quantity": 10}, T)
print("product", st, p.get("id"))
pid = p["id"]
st, p2 = call("POST", "/products", {"name": "SELFTEST big", "type": "accessory", "cost_price": 1000, "sale_price": 1570, "quantity": 5}, T)
pid2 = p2["id"]
it = lambda pid, price: [{"product_id": pid, "quantity": 1, "sale_price": price}]  # noqa: E731
s1 = call("POST", "/sales", {"items": it(pid, 200), "payment_method": "cash", "paid_amount": 200}, T)[1]
s2 = call("POST", "/sales", {"items": it(pid, 500), "payment_method": "card", "paid_amount": 665}, T)[1]
s3 = call("POST", "/sales", {"items": it(pid2, 1570), "payment_method": "mixed", "cash_amount": 900, "paid_amount": 0}, T)[1]
bad = call("POST", "/sales", {"items": it(pid2, 1570), "payment_method": "mixed", "cash_amount": 1570}, T)
print("cash", s1["total"], s1["cash_paid"], s1["card_paid"])
print("card", s2["total"], s2["normal_total"], s2["card_paid"], s2["bank_fee"], s2["vat"])
print("mixed", s3["total"], s3["cash_paid"], s3["card_paid"], s3["bank_fee"], s3["vat"], s3["card_surcharge"])
print("mixed invalid ->", bad[0], bad[1])
from datetime import datetime; from zoneinfo import ZoneInfo; day = datetime.fromisoformat(s1["created_at"]).astimezone(ZoneInfo("Europe/Belgrade")).date().isoformat()
_, dd = call("GET", f"/daybook/day?date={day}", None, T)
s = dd["summary"]
print({k: s[k] for k in ("sales_count", "turnover_cash", "turnover_card", "turnover_total", "cash_in", "bank_in", "revenue", "vat", "cogs",
                          "bank_fees", "gross_profit", "profit_before_tax", "profit_tax", "net_profit")})
print("methods", [(e["method"], e["cash_in"], e["bank_in"]) for e in dd["entries"]])
_, rep = call("GET", f"/daybook/report?date_from={day}&date_to={day}&group=month", None, T)
print("report", {k: rep["totals"][k] for k in ("turnover_total", "bank_fees", "vat", "profit_tax", "net_profit")})
st, pdf = 0, None
req = urllib.request.Request(B + f"/sales/{s3['id']}/invoice.pdf", headers={"Authorization": f"Bearer {T}"})
print("pdf", urllib.request.urlopen(req).status)
