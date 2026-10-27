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
_, p = call("POST", "/products", {"name": "Ekran S21", "type": "accessory", "cost_price": 40, "sale_price": 80, "quantity": 5}, T)
_, sv = call("POST", "/services", {"first_name": "Arben", "phone": "044111222", "device": "Samsung S21", "defect": "Ekrani", "price": 100}, T)
st, sv2 = call("POST", f"/services/{sv['id']}/parts", {"product_id": p["id"], "quantity": 2}, T)
print("add part", st, sv2["parts"], sv2["stock_parts_cost"])
print("too many", call("POST", f"/services/{sv['id']}/parts", {"product_id": p["id"], "quantity": 10}, T))
_, prods = call("GET", "/products", None, T)
print("stock after", [x["quantity"] for x in prods if x["id"] == p["id"]])
call("PATCH", f"/services/{sv['id']}/status", {"status": "delivered", "paid_amount": 100, "paid_method": "cash"}, T)
day = datetime.now(ZoneInfo("Europe/Belgrade")).date().isoformat()
_, dd = call("GET", f"/daybook/day?date={day}", None, T)
print("service profit", dd["summary"]["service_income"], dd["summary"]["service_parts_cost"], dd["summary"]["service_profit"])
st, sv3 = call("DELETE", f"/services/{sv['id']}/parts/{sv2['parts'][0]['id']}", None, T)
_, prods = call("GET", "/products", None, T)
print("remove part", st, sv3["parts"], "stock", [x["quantity"] for x in prods if x["id"] == p["id"]])
call("POST", f"/services/{sv['id']}/parts", {"product_id": p["id"], "quantity": 1}, T)
call("DELETE", f"/services/{sv['id']}", None, T)
_, prods = call("GET", "/products", None, T)
print("after service delete stock", [x["quantity"] for x in prods if x["id"] == p["id"]])
