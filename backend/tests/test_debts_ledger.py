# Debts page (Pagesa/Borxhe): debtor listing, payments validation, customer history ledger, statement PDF
import os
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId

FE_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE_ENV["REACT_APP_BACKEND_URL"]).rstrip("/")
BE_ENV = dotenv_values("/app/backend/.env")
mdb = MongoClient(BE_ENV["MONGO_URL"])[BE_ENV["DB_NAME"]]

state = {"customers": [], "products": [], "sales": [], "suppliers": []}


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    assert r.status_code == 200
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    yield ses
    for cid in state["customers"]:
        mdb.payments.delete_many({"entity_id": cid})
        mdb.customers.delete_one({"_id": ObjectId(cid)})
    for sid in state["sales"]:
        mdb.sales.delete_one({"_id": ObjectId(sid)})
    for pid in state["products"]:
        mdb.products.delete_one({"_id": ObjectId(pid)})
    for sid in state["suppliers"]:
        mdb.payments.delete_many({"entity_id": sid})
        mdb.suppliers.delete_one({"_id": ObjectId(sid)})


def mkcust(s, name, phone="+355 69 123 4567"):
    r = s.post(f"{BASE_URL}/api/customers", json={"name": name, "phone": phone})
    assert r.status_code == 200, r.text
    state["customers"].append(r.json()["id"])
    return r.json()


def credit_sale(s, cid, pid, price, paid):
    r = s.post(f"{BASE_URL}/api/sales", json={"customer_id": cid, "items": [{"product_id": pid, "quantity": 1, "sale_price": price}],
                                              "discount": 0, "paid_amount": paid, "payment_method": "debt"})
    assert r.status_code == 200, r.text
    state["sales"].append(r.json()["id"])
    return r.json()


@pytest.fixture(scope="module")
def setup(s):
    r = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_debt_acc", "type": "accessory", "cost_price": 10, "sale_price": 100, "quantity": 50})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    state["products"].append(pid)
    a = mkcust(s, "TEST_DebtA")
    b = mkcust(s, "TEST_DebtB", phone="")
    credit_sale(s, a["id"], pid, 1000, 300)  # due 700
    credit_sale(s, b["id"], pid, 250, 50)    # due 200
    sup = s.post(f"{BASE_URL}/api/suppliers", json={"name": "TEST_DebtSup"}).json()
    state["suppliers"].append(sup["id"])
    mdb.suppliers.update_one({"_id": ObjectId(sup["id"])}, {"$set": {"balance": 120.0}})
    return {"pid": pid, "a": a, "b": b, "sup": sup}


class TestDebts:
    def test_debtors_balances(self, s, setup):
        cs = {c["id"]: c for c in s.get(f"{BASE_URL}/api/customers").json()}
        assert cs[setup["a"]["id"]]["balance"] == 700
        assert cs[setup["b"]["id"]]["balance"] == 200
        sups = {x["id"]: x for x in s.get(f"{BASE_URL}/api/suppliers").json()}
        assert sups[setup["sup"]["id"]]["balance"] == 120

    def test_payment_zero_rejected(self, s, setup):
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "customer", "entity_id": setup["a"]["id"], "amount": 0, "direction": "in"})
        assert r.status_code == 400

    def test_payment_over_rejected(self, s, setup):
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "customer", "entity_id": setup["a"]["id"], "amount": 700.5, "direction": "in"})
        assert r.status_code == 400

    def test_payment_invalid_entity(self, s, setup):
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "customer", "entity_id": "bad", "amount": 5, "direction": "in"})
        assert r.status_code == 404

    def test_partial_payment(self, s, setup):
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "customer", "entity_id": setup["a"]["id"], "amount": 200, "direction": "in"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["balance_before"] == 700 and d["balance_after"] == 500
        cs = {c["id"]: c for c in s.get(f"{BASE_URL}/api/customers").json()}
        assert cs[setup["a"]["id"]]["balance"] == 500
        assert any(p["id"] == d["id"] for p in s.get(f"{BASE_URL}/api/payments").json())

    def test_history_ledger(self, s, setup):
        r = s.get(f"{BASE_URL}/api/customers/{setup['a']['id']}/history")
        assert r.status_code == 200
        led = r.json()["ledger"]
        kinds = [x["kind"] for x in led]
        assert kinds == ["sale", "payment"], kinds
        assert led[0]["debt"] == 700 and led[0]["balance"] == 700
        assert led[1]["debt"] == -200 and led[1]["balance"] == 500
        assert led[-1]["balance"] == r.json()["customer"]["balance"]

    def test_history_invalid_id(self, s):
        r = s.get(f"{BASE_URL}/api/customers/notanid/history")
        assert r.status_code == 404, f"got {r.status_code}"

    def test_statement_pdf(self, s, setup):
        r = s.get(f"{BASE_URL}/api/customers/{setup['a']['id']}/statement.pdf")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert b"595.27" in r.content and b"841.88" in r.content  # A4
        import re, zlib, base64
        text = b""
        for m in re.finditer(rb"stream\r?\n(.*?)endstream", r.content, re.S):
            raw = m.group(1)
            for dec in (lambda x: zlib.decompress(base64.a85decode(x.strip(), adobe=True)) if x.strip().endswith(b"~>") else zlib.decompress(x), zlib.decompress):
                try:
                    text += dec(raw); break
                except Exception:
                    pass
        assert b"BORXHI AKTUAL" in text
        assert b"500.00" in text and b"TEST_DebtA" in text

    def test_statement_pdf_404(self, s):
        assert s.get(f"{BASE_URL}/api/customers/notanid/statement.pdf").status_code == 404
        assert s.get(f"{BASE_URL}/api/customers/{ObjectId()}/statement.pdf").status_code == 404

    def test_statement_pdf_unauth(self, setup):
        r = requests.get(f"{BASE_URL}/api/customers/{setup['a']['id']}/statement.pdf")
        assert r.status_code == 401
