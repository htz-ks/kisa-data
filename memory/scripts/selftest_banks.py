import json
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

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
_, p = call("POST", "/products", {"name": "X", "type": "accessory", "cost_price": 100, "sale_price": 500, "quantity": 10}, T)
it = [{"product_id": p["id"], "quantity": 1, "sale_price": 500}]
print("card no bank", call("POST", "/sales", {"items": it, "payment_method": "card"}, T)[0])
print("card TEB", call("POST", "/sales", {"items": it, "payment_method": "card", "bank": "TEB"}, T)[1]["bank"])
print("mixed NLB", call("POST", "/sales", {"items": it, "payment_method": "mixed", "cash_amount": 200, "bank": "NLB"}, T)[1]["card_paid"])
print("cash", call("POST", "/sales", {"items": it, "payment_method": "cash", "bank": "TEB"}, T)[1]["bank"])
print("expense bank", call("POST", "/expenses", {"category": "Rryma", "amount": 50, "pay_method": "bank", "bank": "TEB"}, T)[0])
print("expense bad bank", call("POST", "/expenses", {"category": "Rryma", "amount": 50, "pay_method": "bank", "bank": "XYZ"}, T)[0])
print("purchase bank", call("POST", "/purchases", {"items": [{"product_id": p["id"], "quantity": 1, "cost_price": 100}], "paid_amount": 100, "pay_method": "bank", "bank": "BKT"}, T)[0])
print("transfer cash->BKT", call("POST", "/banks/transfers", {"source": "cash", "target": "BKT", "amount": 300}, T)[0])
print("transfer TEB->cash", call("POST", "/banks/transfers", {"source": "TEB", "target": "cash", "amount": 100}, T)[0])
print("transfer TEB->NLB", call("POST", "/banks/transfers", {"source": "TEB", "target": "NLB", "amount": 50}, T)[0])
_, b = call("GET", "/banks", None, T)
print({x["bank"]: x["balance"] for x in b["banks"]}, b["total"])
_, h = call("GET", "/banks/history/TEB", None, T)
print([(m["type"], m["in"], m["out"], m["balance"]) for m in h])
day = datetime.now(ZoneInfo("Europe/Belgrade")).date().isoformat()
_, dd = call("GET", f"/daybook/day?date={day}", None, T)
s = dd["summary"]
print("cash_in", s["cash_in"], "cash_out", s["cash_out"], "bank_in", s["bank_in"], "bank_out", s["bank_out"], "net", s["net_profit"])
