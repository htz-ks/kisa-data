# Seed/clean TEST_UIR data for returns/expenses UI testing. Usage: python seed_returns_ui.py seed|clean
import sys, requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
BE = dotenv_values("/app/backend/.env")
db = MongoClient(BE["MONGO_URL"])[BE["DB_NAME"]]

if sys.argv[1] == "seed":
    s = requests.Session()
    t = s.post(f"{BASE}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"}).json()["access_token"]
    s.headers["Authorization"] = f"Bearer {t}"
    p = s.post(f"{BASE}/api/products", json={"name": "TEST_UIR_phone", "type": "phone", "cost_price": 100, "sale_price": 150,
                                             "quantity": 2, "imeis": ["TESTUIR0001", "TESTUIR0002"]}).json()
    for imei in ["TESTUIR0001", "TESTUIR0002"]:
        r = s.post(f"{BASE}/api/sales", json={"customer_id": "", "items": [{"product_id": p["id"], "quantity": 1, "sale_price": 150, "imei": imei}],
                                              "discount": 0, "paid_amount": 150, "payment_method": "cash"}).json()
        print(imei, r["id"], r["invoice_no"])
else:
    sids = [str(x["_id"]) for x in db.sales.find({"items.product_name": {"$regex": "^TEST_UIR"}})]
    print("returns", db.returns.delete_many({"$or": [{"sale_id": {"$in": sids}}, {"items.product_name": {"$regex": "^TEST_UIR"}}]}).deleted_count)
    print("sales", db.sales.delete_many({"items.product_name": {"$regex": "^TEST_UIR"}}).deleted_count)
    print("products", db.products.delete_many({"name": {"$regex": "^TEST_UIR"}}).deleted_count)
    print("expenses", db.expenses.delete_many({"description": {"$regex": "^TEST_"}}).deleted_count)
