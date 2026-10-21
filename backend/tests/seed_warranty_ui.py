# Seed/clean TEST_ products for warranty UI testing. Usage: python seed_warranty_ui.py seed|clean
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
    for body in [
        {"name": "TEST_UIW_acc", "type": "accessory", "cost_price": 5, "sale_price": 10, "quantity": 20},
        {"name": "TEST_UIW_phone", "type": "phone", "cost_price": 100, "sale_price": 150, "quantity": 2,
         "warranty_months": 12, "imeis": ["TESTUIW0001", "TESTUIW0002"]},
    ]:
        r = s.post(f"{BASE}/api/products", json=body)
        print(r.status_code, r.json().get("id"), r.json().get("name"))
else:
    sales = db.sales.delete_many({"items.product_name": {"$regex": "^TEST_UIW"}})
    cust = db.customers.delete_many({"name": {"$regex": "^TEST_UIW"}})
    prods = db.products.delete_many({"name": {"$regex": "^TEST_UIW"}})
    print("deleted sales", sales.deleted_count, "customers", cust.deleted_count, "products", prods.deleted_count)
