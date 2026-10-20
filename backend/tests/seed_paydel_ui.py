# Seed/cleanup TEST_ data for payment-delete + supplier history UI test. Usage: python seed_paydel_ui.py [seed|clean]
import sys, json, requests
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId

B = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]

if sys.argv[1] == "clean":
    for c in ["suppliers", "customers"]:
        for x in db[c].find({"name": {"$regex": "^TEST_UI"}}):
            db.payments.delete_many({"entity_id": str(x["_id"])})
            db.purchases.delete_many({"supplier_id": str(x["_id"])})
            db.sales.delete_many({"customer_id": str(x["_id"])})
            db[c].delete_one({"_id": x["_id"]})
    db.products.delete_many({"name": {"$regex": "^TEST_UI"}})
    print("cleaned")
    sys.exit()

s = requests.Session()
s.headers["Authorization"] = "Bearer " + s.post(f"{B}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"}).json()["access_token"]
pid = s.post(f"{B}/api/products", json={"name": "TEST_UI_acc", "type": "accessory", "cost_price": 10, "sale_price": 100, "quantity": 20}).json()["id"]
sup = s.post(f"{B}/api/suppliers", json={"name": "TEST_UI_Sup", "phone": "+355 69 888 7777"}).json()
pur = s.post(f"{B}/api/purchases", json={"supplier_id": sup["id"], "items": [{"product_id": pid, "quantity": 4, "cost_price": 100}], "paid_amount": 100}).json()
spay = s.post(f"{B}/api/payments", json={"entity_type": "supplier", "entity_id": sup["id"], "amount": 120, "direction": "out", "notes": ""}).json()
cus = s.post(f"{B}/api/customers", json={"name": "TEST_UI_Cust", "phone": "+355 69 777 6666"}).json()
s.post(f"{B}/api/sales", json={"customer_id": cus["id"], "items": [{"product_id": pid, "quantity": 1, "sale_price": 500}], "discount": 0, "paid_amount": 100, "payment_method": "debt"})
cpay = s.post(f"{B}/api/payments", json={"entity_type": "customer", "entity_id": cus["id"], "amount": 75, "direction": "in", "notes": ""}).json()
print(json.dumps({"sup": sup["id"], "pur": pur["id"], "spay": spay["id"], "cus": cus["id"], "cpay": cpay["id"]}))
