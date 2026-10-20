# Payment deletion (restore debt) + supplier debt history/ledger/statement PDF + customer regression
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

st = {"customers": [], "products": [], "sales": [], "suppliers": [], "purchases": []}


def login(email, pw):
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return ses


@pytest.fixture(scope="module")
def s():
    ses = login("admin@prodata.al", "admin123")
    yield ses
    for cid in st["customers"]:
        mdb.payments.delete_many({"entity_id": cid})
        mdb.customers.delete_one({"_id": ObjectId(cid)})
    for sid in st["suppliers"]:
        mdb.payments.delete_many({"entity_id": sid})
        mdb.suppliers.delete_one({"_id": ObjectId(sid)})
    for x in st["sales"]:
        mdb.sales.delete_one({"_id": ObjectId(x)})
    for x in st["purchases"]:
        mdb.purchases.delete_one({"_id": ObjectId(x)})
    for x in st["products"]:
        mdb.products.delete_one({"_id": ObjectId(x)})


@pytest.fixture(scope="module")
def emp():
    return login("punonjes@prodata.al", "punonjes123")


@pytest.fixture(scope="module")
def setup(s):
    r = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_pd_acc", "type": "accessory", "cost_price": 10, "sale_price": 100, "quantity": 50})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    st["products"].append(pid)
    r = s.post(f"{BASE_URL}/api/suppliers", json={"name": "TEST_SupHist", "phone": "+355 69 999 0000"})
    assert r.status_code == 200, r.text
    sup = r.json()
    st["suppliers"].append(sup["id"])
    # purchase 1: total 500, paid 100 -> due 400 ; purchase 2: total 300, paid 300 -> no due
    p1 = s.post(f"{BASE_URL}/api/purchases", json={"supplier_id": sup["id"], "items": [{"product_id": pid, "quantity": 5, "cost_price": 100}], "paid_amount": 100})
    assert p1.status_code == 200, p1.text
    st["purchases"].append(p1.json()["id"])
    p2 = s.post(f"{BASE_URL}/api/purchases", json={"supplier_id": sup["id"], "items": [{"product_id": pid, "quantity": 3, "cost_price": 100}], "paid_amount": 300})
    assert p2.status_code == 200, p2.text
    st["purchases"].append(p2.json()["id"])
    r = s.post(f"{BASE_URL}/api/customers", json={"name": "TEST_PayDelCust", "phone": "+355 69 111 2222"})
    cust = r.json()
    st["customers"].append(cust["id"])
    r = s.post(f"{BASE_URL}/api/sales", json={"customer_id": cust["id"], "items": [{"product_id": pid, "quantity": 1, "sale_price": 600}],
                                              "discount": 0, "paid_amount": 100, "payment_method": "debt"})
    assert r.status_code == 200, r.text
    st["sales"].append(r.json()["id"])
    return {"pid": pid, "sup": sup, "cust": cust, "p1": p1.json()["id"], "p2": p2.json()["id"]}


def bal(s, kind, eid):
    return next(x for x in s.get(f"{BASE_URL}/api/{kind}").json() if x["id"] == eid)["balance"]


class TestSupplierHistory:
    def test_balance_after_purchases(self, s, setup):
        assert bal(s, "suppliers", setup["sup"]["id"]) == pytest.approx(400)

    def test_history_structure(self, s, setup):
        sid = setup["sup"]["id"]
        s.post(f"{BASE_URL}/api/payments", json={"entity_type": "supplier", "entity_id": sid, "amount": 150, "direction": "out", "notes": ""})
        r = s.get(f"{BASE_URL}/api/suppliers/{sid}/history")
        assert r.status_code == 200
        d = r.json()
        assert d["supplier"]["name"] == "TEST_SupHist"
        assert d["totals"]["purchases_count"] == 2
        assert d["totals"]["total_bought"] == pytest.approx(800)
        assert d["totals"]["total_paid"] == pytest.approx(550)
        led = d["ledger"]
        assert [r["kind"] for r in led] == ["sale", "payment"]
        assert led[0]["doc"] == "Blerje" and led[0]["debt"] == pytest.approx(400)
        assert led[1]["debt"] == pytest.approx(-150)
        assert led[-1]["balance"] == pytest.approx(d["supplier"]["balance"]) == pytest.approx(250)
        pd = d["purchase_debts"]
        assert setup["p2"] not in pd
        dd = pd[setup["p1"]]
        assert dd["original_debt"] == pytest.approx(400) and dd["paid_at_sale"] == pytest.approx(100)
        assert dd["remaining"] == pytest.approx(250)
        assert [p["amount"] for p in dd["payments"]] == [pytest.approx(150)]

    def test_statement_pdf(self, s, setup):
        r = s.get(f"{BASE_URL}/api/suppliers/{setup['sup']['id']}/statement.pdf")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_invalid_ids(self, s):
        for path in ["history", "statement.pdf"]:
            assert s.get(f"{BASE_URL}/api/suppliers/bad/{path}").status_code == 404
            assert s.get(f"{BASE_URL}/api/suppliers/{ObjectId()}/{path}").status_code == 404

    def test_employee_forbidden(self, emp, setup):
        for path in ["history", "statement.pdf"]:
            assert emp.get(f"{BASE_URL}/api/suppliers/{setup['sup']['id']}/{path}").status_code == 403

    def test_unauth(self, setup):
        assert requests.get(f"{BASE_URL}/api/suppliers/{setup['sup']['id']}/history").status_code == 401


class TestDeletePayment:
    def test_delete_supplier_payment_restores(self, s, setup):
        sid = setup["sup"]["id"]
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "supplier", "entity_id": sid, "amount": 50, "direction": "out", "notes": ""})
        assert r.status_code == 200
        pay_id = r.json()["id"]
        before = bal(s, "suppliers", sid)
        r = s.delete(f"{BASE_URL}/api/payments/{pay_id}")
        assert r.status_code == 200 and r.json()["restored"] == pytest.approx(50)
        assert bal(s, "suppliers", sid) == pytest.approx(before + 50)
        assert all(p["id"] != pay_id for p in s.get(f"{BASE_URL}/api/payments").json())
        # second delete -> 404
        assert s.delete(f"{BASE_URL}/api/payments/{pay_id}").status_code == 404

    def test_delete_customer_payment_restores_and_ledger(self, s, setup):
        cid = setup["cust"]["id"]
        assert bal(s, "customers", cid) == pytest.approx(500)
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "customer", "entity_id": cid, "amount": 200, "direction": "in", "notes": ""})
        pay_id = r.json()["id"]
        assert bal(s, "customers", cid) == pytest.approx(300)
        h = s.get(f"{BASE_URL}/api/customers/{cid}/history").json()
        assert h["ledger"][-1]["balance"] == pytest.approx(300)
        assert s.delete(f"{BASE_URL}/api/payments/{pay_id}").status_code == 200
        assert bal(s, "customers", cid) == pytest.approx(500)
        h = s.get(f"{BASE_URL}/api/customers/{cid}/history").json()
        assert [r["kind"] for r in h["ledger"]] == ["sale"]
        assert h["ledger"][-1]["balance"] == pytest.approx(500)
        assert list(h["sale_debts"].values())[0]["remaining"] == pytest.approx(500)

    def test_customer_pdf_regression(self, s, setup):
        r = s.get(f"{BASE_URL}/api/customers/{setup['cust']['id']}/statement.pdf")
        assert r.status_code == 200 and r.content[:4] == b"%PDF"

    def test_delete_invalid(self, s):
        assert s.delete(f"{BASE_URL}/api/payments/bad").status_code == 404
        assert s.delete(f"{BASE_URL}/api/payments/{ObjectId()}").status_code == 404

    def test_employee_cannot_delete(self, s, emp, setup):
        cid = setup["cust"]["id"]
        r = s.post(f"{BASE_URL}/api/payments", json={"entity_type": "customer", "entity_id": cid, "amount": 10, "direction": "in", "notes": ""})
        pay_id = r.json()["id"]
        assert emp.delete(f"{BASE_URL}/api/payments/{pay_id}").status_code == 403
        assert bal(s, "customers", cid) == pytest.approx(490)
        assert s.delete(f"{BASE_URL}/api/payments/{pay_id}").status_code == 200
        assert bal(s, "customers", cid) == pytest.approx(500)
