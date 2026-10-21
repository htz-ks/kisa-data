# Supplier cards + customer cards + supplier payment flow regression tests
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}")
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@prodata.al", "admin123")


@pytest.fixture(scope="module")
def emp():
    return _login("punonjes@prodata.al", "punonjes123")


class TestCards:
    def test_supplier_cards_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/supplier-cards")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for k in ("id", "name", "phone", "invoices", "bought", "paid", "balance"):
            assert k in data[0]

    def test_supplier_balance_consistency(self, admin):
        data = admin.get(f"{BASE_URL}/api/supplier-cards").json()
        mismatches = [(c["name"], c["bought"], c["paid"], c["balance"]) for c in data
                      if abs(round(c["bought"] - c["paid"], 2) - c["balance"]) > 0.01]
        print("supplier mismatches:", mismatches)
        assert not mismatches, mismatches

    def test_customer_cards_list(self, admin):
        r = admin.get(f"{BASE_URL}/api/customer-cards")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_employee_forbidden(self, emp):
        assert emp.get(f"{BASE_URL}/api/supplier-cards").status_code == 403
        assert emp.get(f"{BASE_URL}/api/customer-cards").status_code == 403

    def test_supplier_statement_pdf_png(self, admin):
        data = admin.get(f"{BASE_URL}/api/supplier-cards").json()
        sid = data[0]["id"]
        r = admin.get(f"{BASE_URL}/api/suppliers/{sid}/statement.pdf")
        assert r.status_code == 200 and r.content[:4] == b"%PDF"
        r = admin.get(f"{BASE_URL}/api/suppliers/{sid}/statement.png")
        assert r.status_code == 200 and r.content[:4] == b"\x89PNG"

    def test_supplier_pay_and_delete(self, admin):
        data = admin.get(f"{BASE_URL}/api/supplier-cards").json()
        sup = next((c for c in data if c["balance"] > 20), None)
        if not sup:
            pytest.skip("no supplier with debt")
        r = admin.post(f"{BASE_URL}/api/payments", json={"entity_type": "supplier", "entity_id": sup["id"],
                                                          "amount": 5, "direction": "out", "notes": "TEST_pay"})
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        after = next(c for c in admin.get(f"{BASE_URL}/api/supplier-cards").json() if c["id"] == sup["id"])
        assert round(sup["balance"] - after["balance"], 2) == 5
        assert round(after["paid"] - sup["paid"], 2) == 5
        # overpay
        r = admin.post(f"{BASE_URL}/api/payments", json={"entity_type": "supplier", "entity_id": sup["id"],
                                                          "amount": after["balance"] + 100, "direction": "out"})
        assert r.status_code == 400
        # cleanup
        assert admin.delete(f"{BASE_URL}/api/payments/{pid}").status_code == 200
        restored = next(c for c in admin.get(f"{BASE_URL}/api/supplier-cards").json() if c["id"] == sup["id"])
        assert restored["balance"] == sup["balance"]
