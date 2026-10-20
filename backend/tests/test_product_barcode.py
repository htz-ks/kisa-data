# Product barcode (manual / auto-generated EAN-13 / duplicate) + role tests
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
created = []


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def admin():
    return _login("admin@prodata.al", "admin123")


@pytest.fixture(scope="module")
def emp():
    return _login("punonjes@prodata.al", "punonjes123")


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    for pid in created:
        requests.delete(f"{BASE_URL}/api/products/{pid}", headers=admin)


def ean_ok(code):
    d = code[:12]
    check = (10 - sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(d)) % 10) % 10
    return int(code[12]) == check


class TestBarcode:
    def test_empty_barcode_autogen(self, admin):
        r = requests.post(f"{BASE_URL}/api/products", headers=admin,
                          json={"name": "TEST_auto_bc", "sale_price": 5, "quantity": 3})
        assert r.status_code == 200, r.text
        d = r.json()
        created.append(d["id"])
        assert len(d["barcode"]) == 13 and d["barcode"].isdigit() and d["barcode"].startswith("20")
        assert ean_ok(d["barcode"])
        assert d["code"].isdigit()
        g = requests.get(f"{BASE_URL}/api/products/{d['id']}", headers=admin)
        assert g.json()["barcode"] == d["barcode"]

    def test_manual_barcode_and_duplicate(self, admin):
        bc = "TEST9988776655"
        r = requests.post(f"{BASE_URL}/api/products", headers=admin, json={"name": "TEST_man_bc", "barcode": f"  {bc} "})
        assert r.status_code == 200, r.text
        created.append(r.json()["id"])
        assert r.json()["barcode"] == bc
        r2 = requests.post(f"{BASE_URL}/api/products", headers=admin, json={"name": "TEST_dup_bc", "barcode": bc})
        assert r2.status_code == 400
        assert "ekziston" in r2.json()["detail"]
        if r2.status_code == 200:
            created.append(r2.json()["id"])

    def test_phone_autogen(self, admin):
        r = requests.post(f"{BASE_URL}/api/products", headers=admin,
                          json={"name": "TEST_phone_bc", "type": "phone", "imeis": ["TEST111222333444"]})
        assert r.status_code == 200
        created.append(r.json()["id"])
        assert len(r.json()["barcode"]) == 13 and r.json()["quantity"] == 1

    def test_update_barcode(self, admin):
        r = requests.post(f"{BASE_URL}/api/products", headers=admin, json={"name": "TEST_upd_bc"})
        pid = r.json()["id"]; created.append(pid)
        u = requests.put(f"{BASE_URL}/api/products/{pid}", headers=admin, json={"barcode": "TEST_UPD_123", "sale_price": 9})
        assert u.status_code == 200
        g = requests.get(f"{BASE_URL}/api/products/{pid}", headers=admin).json()
        assert g["barcode"] == "TEST_UPD_123" and g["sale_price"] == 9

    def test_update_to_duplicate_barcode_rejected(self, admin):
        # Expected: PUT should reject duplicate barcode like POST does
        a = requests.post(f"{BASE_URL}/api/products", headers=admin, json={"name": "TEST_dupA", "barcode": "TEST_DUPA_1"}).json()
        b = requests.post(f"{BASE_URL}/api/products", headers=admin, json={"name": "TEST_dupB"}).json()
        created.extend([a["id"], b["id"]])
        u = requests.put(f"{BASE_URL}/api/products/{b['id']}", headers=admin, json={"barcode": "TEST_DUPA_1"})
        assert u.status_code == 400, f"PUT allowed duplicate barcode: {u.status_code}"

    def test_employee_cannot_create(self, emp):
        r = requests.post(f"{BASE_URL}/api/products", headers=emp, json={"name": "TEST_emp"})
        assert r.status_code == 403
        if r.status_code == 200:
            created.append(r.json()["id"])
