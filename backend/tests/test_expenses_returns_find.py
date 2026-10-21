# Iteration 11: Expenses CRUD + permissions, and the data the Returns "find" box relies on
import os
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}")
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@prodata.al", "admin123")


@pytest.fixture(scope="module")
def emp():
    return _login("punonjes@prodata.al", "punonjes123")


@pytest.fixture(scope="module")
def created(admin):
    ids = []
    yield ids
    for i in ids:
        admin.delete(f"{BASE_URL}/api/expenses/{i}")


# ---------- Expenses ----------
class TestExpenses:
    def test_create_and_list(self, admin, created):
        r = admin.post(f"{BASE_URL}/api/expenses", json={"category": "Rryma", "description": "TEST_exp rryma", "amount": 42.5, "date": "2026-01-15"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 42.5 and d["category"] == "Rryma" and d["date"] == "2026-01-15"
        assert d["description"] == "TEST_exp rryma" and isinstance(d["id"], str) and "_id" not in d
        assert d.get("created_by_name")
        created.append(d["id"])
        lst = admin.get(f"{BASE_URL}/api/expenses").json()
        assert any(e["id"] == d["id"] and e["amount"] == 42.5 for e in lst)

    def test_default_date_and_category(self, admin, created):
        r = admin.post(f"{BASE_URL}/api/expenses", json={"amount": 3, "description": "TEST_exp default"})
        assert r.status_code == 200
        d = r.json()
        created.append(d["id"])
        assert d["category"] == "Tjetër" and len(d["date"]) == 10

    def test_sorted_by_date_desc(self, admin):
        lst = admin.get(f"{BASE_URL}/api/expenses").json()
        dates = [e["date"] for e in lst]
        assert dates == sorted(dates, reverse=True)

    @pytest.mark.parametrize("amt", [0, -5])
    def test_non_positive_amount_400(self, admin, amt):
        r = admin.post(f"{BASE_URL}/api/expenses", json={"amount": amt, "description": "TEST_exp bad"})
        assert r.status_code == 400
        assert "detail" in r.json()

    def test_missing_amount_422(self, admin):
        r = admin.post(f"{BASE_URL}/api/expenses", json={"description": "TEST_exp no amount"})
        assert r.status_code == 422

    def test_employee_forbidden(self, emp):
        assert emp.get(f"{BASE_URL}/api/expenses").status_code == 403
        assert emp.post(f"{BASE_URL}/api/expenses", json={"amount": 5}).status_code == 403
        assert emp.delete(f"{BASE_URL}/api/expenses/000000000000000000000000").status_code == 403

    def test_anonymous_rejected(self):
        assert requests.get(f"{BASE_URL}/api/expenses").status_code in (401, 403)

    def test_delete_and_verify(self, admin):
        d = admin.post(f"{BASE_URL}/api/expenses", json={"amount": 7, "description": "TEST_exp del"}).json()
        r = admin.delete(f"{BASE_URL}/api/expenses/{d['id']}")
        assert r.status_code == 200 and r.json()["ok"] is True
        assert not any(e["id"] == d["id"] for e in admin.get(f"{BASE_URL}/api/expenses").json())
        assert admin.delete(f"{BASE_URL}/api/expenses/{d['id']}").status_code == 404

    def test_delete_unknown_and_invalid_404(self, admin):
        assert admin.delete(f"{BASE_URL}/api/expenses/000000000000000000000000").status_code == 404
        assert admin.delete(f"{BASE_URL}/api/expenses/not-an-id").status_code == 404


# ---------- Returns find data (sales list contains invoice_no + items.imei) ----------
class TestReturnFindData:
    def test_sale_list_has_invoice_and_imei_and_return(self, admin):
        p = admin.post(f"{BASE_URL}/api/products", json={"name": "TEST_RF_phone", "type": "phone", "cost_price": 100, "sale_price": 150,
                                                        "quantity": 1, "imeis": ["TESTRF00001"]}).json()
        try:
            s = admin.post(f"{BASE_URL}/api/sales", json={"customer_id": "", "items": [{"product_id": p["id"], "quantity": 1, "sale_price": 150, "imei": "TESTRF00001"}],
                                                       "discount": 0, "paid_amount": 150, "payment_method": "cash"})
            assert s.status_code == 200, s.text
            sale = s.json()
            sales = admin.get(f"{BASE_URL}/api/sales").json()
            found = [x for x in sales if x["id"] == sale["id"]][0]
            assert found["invoice_no"].startswith("INV-")
            assert any(it.get("imei") == "TESTRF00001" for it in found["items"])
            rr = admin.post(f"{BASE_URL}/api/sales/{sale['id']}/return", json={"items": [{"index": 0, "quantity": 1}], "reason": "TEST_RF"})
            assert rr.status_code == 200, rr.text
            rets = admin.get(f"{BASE_URL}/api/returns").json()
            assert any(r["invoice_no"] == sale["invoice_no"] for r in rets)
        finally:
            from pymongo import MongoClient
            be = dotenv_values("/app/backend/.env")
            db = MongoClient(be["MONGO_URL"])[be["DB_NAME"]]
            db.returns.delete_many({"reason": "TEST_RF"})
            db.sales.delete_many({"items.product_name": "TEST_RF_phone"})
            db.products.delete_many({"name": "TEST_RF_phone"})
