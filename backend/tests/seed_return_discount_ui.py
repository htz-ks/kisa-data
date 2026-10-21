# Seed/clean TEST_RDUI data for ReturnDialog discount UI testing. Usage: python seed_return_discount_ui.py seed|clean
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
    p = s.post(f"{BASE}/api/products", json={"name": "TEST_RDUI_acc", "type": "accessory", "cost_price": 5, "sale_price": 15, "quantity": 5}).json()
    print("PID", p["id"])
    for _ in range(3):
        r = s.post(f"{BASE}/api/sales", json={"customer_id": "", "items": [{"product_id": p["id"], "quantity": 1, "sale_price": 15}],
                                              "discount": 3, "paid_amount": 12, "payment_method": "cash"}).json()
        print("SALE", r["id"], r["invoice_no"])
else:
    sids = [str(x["_id"]) for x in db.sales.find({"items.product_name": {"$regex": "^TEST_RDUI"}})]
    print("returns", db.returns.delete_many({"sale_id": {"$in": sids}}).deleted_count)
    print("sales", db.sales.delete_many({"items.product_name": {"$regex": "^TEST_RDUI"}}).deleted_count)
    print("products", db.products.delete_many({"name": {"$regex": "^TEST_RDUI"}}).deleted_count)
