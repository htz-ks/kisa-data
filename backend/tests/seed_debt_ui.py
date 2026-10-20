# Seed/cleanup TEST_ debtors for UI testing of /payments. Usage: python seed_debt_ui.py seed|clean
import sys, json, requests
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]

if sys.argv[1] == "seed":
    s = requests.Session()
    s.headers["Authorization"] = "Bearer " + s.post(f"{BASE}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"}).json()["access_token"]
    pid = s.post(f"{BASE}/api/products", json={"name": "TEST_debt_acc", "type": "accessory", "cost_price": 10, "sale_price": 100, "quantity": 50}).json()["id"]
    out = {}
    for name, phone, total, paid in [("TEST_UIDebtA", "+355 69 111 2222", 1000, 300), ("TEST_UIDebtB", "", 250, 50)]:
        c = s.post(f"{BASE}/api/customers", json={"name": name, "phone": phone}).json()
        s.post(f"{BASE}/api/sales", json={"customer_id": c["id"], "items": [{"product_id": pid, "quantity": 1, "sale_price": total}], "paid_amount": paid, "payment_method": "debt"})
        out[name] = c["id"]
    sup = s.post(f"{BASE}/api/suppliers", json={"name": "TEST_UIDebtSup"}).json()
    db.suppliers.update_one({"_id": ObjectId(sup["id"])}, {"$set": {"balance": 120.0}})
    out["sup"] = sup["id"]
    print(json.dumps(out))
else:
    for c in db.customers.find({"name": {"$regex": "^TEST_"}}):
        cid = str(c["_id"])
        db.payments.delete_many({"entity_id": cid}); db.sales.delete_many({"customer_id": cid}); db.customers.delete_one({"_id": c["_id"]})
    for sp in db.suppliers.find({"name": {"$regex": "^TEST_"}}):
        db.payments.delete_many({"entity_id": str(sp["_id"])}); db.suppliers.delete_one({"_id": sp["_id"]})
    db.products.delete_many({"name": {"$regex": "^TEST_debt"}})
    print("cleaned")
