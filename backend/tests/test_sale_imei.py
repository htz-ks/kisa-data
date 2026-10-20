# Sale IMEI flow tests: auto IMEI fields in sale items, typed (unregistered) IMEI, errors, return, PDF invoice
import os
import pytest
import requests
from pathlib import Path
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId

FE_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE_ENV["REACT_APP_BACKEND_URL"]).rstrip("/")
BE_ENV = dotenv_values("/app/backend/.env")
mdb = MongoClient(BE_ENV["MONGO_URL"])[BE_ENV["DB_NAME"]]

created_products, created_sales = [], []


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    assert r.status_code == 200
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    yield ses
    # cleanup
    for sid in created_sales:
        mdb.sales.delete_one({"_id": ObjectId(sid)})
        mdb.returns.delete_many({"sale_id": sid})
    for pid in created_products:
        mdb.products.delete_one({"_id": ObjectId(pid)})


def mkprod(s, **kw):
    body = {"name": "TEST_IMEI_phone", "type": "phone", "cost_price": 100, "sale_price": 150, "quantity": 2, "imeis": []}
    body.update(kw)
    r = s.post(f"{BASE_URL}/api/products", json=body)
    assert r.status_code == 200, r.text
    created_products.append(r.json()["id"])
    return r.json()


def sell(s, pid, imei=None, qty=1, price=150):
    r = s.post(f"{BASE_URL}/api/sales", json={"customer_id": "", "items": [{"product_id": pid, "quantity": qty, "sale_price": price, "imei": imei}],
                                              "discount": 0, "paid_amount": price, "payment_method": "cash"})
    if r.status_code == 200:
        created_sales.append(r.json()["id"])
    return r


def getp(s, pid):
    return s.get(f"{BASE_URL}/api/products/{pid}").json()


class TestSaleImei:
    def test_registered_imei_sale_has_code_barcode_imei(self, s):
        p = mkprod(s, name="TEST_IMEI_reg", imeis=["TESTREG001", "TESTREG002"])
        r = sell(s, p["id"], "TESTREG001")
        assert r.status_code == 200, r.text
        it = r.json()["items"][0]
        assert it["product_code"] == p["code"] and it["barcode"] == p["barcode"]
        assert it["imei"] == "TESTREG001" and it["quantity"] == 1
        g = getp(s, p["id"])
        assert g["quantity"] == 1
        assert [x["status"] for x in g["imeis"] if x["imei"] == "TESTREG001"] == ["sold"]

    def test_typed_imei_on_phone_without_imeis(self, s):
        p = mkprod(s, name="TEST_IMEI_noimei", quantity=2)
        r = sell(s, p["id"], "  TESTIMEI999 ")
        assert r.status_code == 200, r.text
        assert r.json()["items"][0]["imei"] == "TESTIMEI999"
        g = getp(s, p["id"])
        assert g["quantity"] == 1
        assert any(x["imei"] == "TESTIMEI999" and x["status"] == "sold" for x in g["imeis"])
        # sell again -> already sold
        r2 = sell(s, p["id"], "TESTIMEI999")
        assert r2.status_code == 400 and "shitur më parë" in r2.json()["detail"]
        assert getp(s, p["id"])["quantity"] == 1
        # return -> qty +1 and IMEI back in stock
        sid = r.json()["id"]
        rr = s.post(f"{BASE_URL}/api/sales/{sid}/return", json={"items": [{"index": 0, "quantity": 1}], "reason": "TEST"})
        assert rr.status_code == 200, rr.text
        g = getp(s, p["id"])
        assert g["quantity"] == 2
        assert any(x["imei"] == "TESTIMEI999" and x["status"] == "in_stock" for x in g["imeis"])
        # can be sold again after return
        r3 = sell(s, p["id"], "TESTIMEI999")
        assert r3.status_code == 200, r3.text

    def test_qty_zero_unknown_imei(self, s):
        p = mkprod(s, name="TEST_IMEI_zero", quantity=0)
        r = sell(s, p["id"], "TESTUNKNOWN1")
        assert r.status_code == 400 and "nuk është në stok" in r.json()["detail"]

    def test_empty_imei(self, s):
        p = mkprod(s, name="TEST_IMEI_empty", quantity=1)
        for v in (None, ""):
            r = sell(s, p["id"], v)
            assert r.status_code == 400 and "IMEI mungon" in r.json()["detail"]

    def test_whitespace_imei(self, s):
        p = mkprod(s, name="TEST_IMEI_ws", quantity=1)
        r = sell(s, p["id"], "   ")
        assert r.status_code == 400, f"whitespace IMEI accepted: {r.text}"

    def test_unknown_imei_when_all_stock_is_registered(self, s):
        # quantity 2 = 2 registered IMEIs; typing a random IMEI should not be accepted (stock inconsistency)
        p = mkprod(s, name="TEST_IMEI_allreg", imeis=["TESTALL1", "TESTALL2"])
        r = sell(s, p["id"], "TESTRANDOM")
        assert r.status_code == 400, f"Random IMEI accepted though all stock is registered IMEIs: qty now {getp(s, p['id'])['quantity']}"

    def test_pdf_invoice(self, s):
        p = mkprod(s, name="TEST_IMEI_pdf", imeis=["TESTPDF01"])
        r = sell(s, p["id"], "TESTPDF01")
        sid = r.json()["id"]
        pdf = s.get(f"{BASE_URL}/api/sales/{sid}/invoice.pdf")
        assert pdf.status_code == 200 and pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"
        try:
            from pypdf import PdfReader
            import io
            txt = "".join(pg.extract_text() for pg in PdfReader(io.BytesIO(pdf.content)).pages)
            for w in ("Shifra", "Barkodi", "IMEI", "TESTPDF01", p["code"], p["barcode"]):
                assert w in txt, w
        except ImportError:
            pass

    def test_partial_failure_no_side_effects(self, s):
        # accessory row OK + phone row missing IMEI -> 400; accessory stock should not be decremented
        acc = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_IMEI_acc", "type": "accessory", "quantity": 5, "sale_price": 5}).json()
        created_products.append(acc["id"])
        ph = mkprod(s, name="TEST_IMEI_part", quantity=1)
        r = s.post(f"{BASE_URL}/api/sales", json={"customer_id": "", "items": [
            {"product_id": acc["id"], "quantity": 1, "sale_price": 5},
            {"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": None}],
            "discount": 0, "paid_amount": 155, "payment_method": "cash"})
        assert r.status_code == 400
        assert getp(s, acc["id"])["quantity"] == 5, "accessory stock decremented although sale failed"


def post_sale(s, items):
    r = s.post(f"{BASE_URL}/api/sales", json={"customer_id": "", "items": items, "discount": 0, "paid_amount": 0, "payment_method": "cash"})
    if r.status_code == 200:
        created_sales.append(r.json()["id"])
    return r


# Iteration 5: two-phase validation of POST /api/sales
class TestSaleAtomic:
    def test_duplicate_imei_same_request(self, s):
        acc = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_IMEI_acc2", "type": "accessory", "quantity": 5, "sale_price": 5}).json()
        created_products.append(acc["id"])
        ph = mkprod(s, name="TEST_IMEI_dup", imeis=["TESTDUP1", "TESTDUP2"])
        r = post_sale(s, [{"product_id": acc["id"], "quantity": 2, "sale_price": 5},
                          {"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTDUP1"},
                          {"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": " TESTDUP1 "}])
        assert r.status_code == 400 and "vendosur dy herë" in r.json()["detail"], r.text
        assert getp(s, acc["id"])["quantity"] == 5
        g = getp(s, ph["id"])
        assert g["quantity"] == 2 and all(x["status"] == "in_stock" for x in g["imeis"])

    def test_insufficient_stock_later_row_no_side_effects(self, s):
        ph = mkprod(s, name="TEST_IMEI_first", imeis=["TESTFIRST1"], quantity=1)
        acc = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_IMEI_acc3", "type": "accessory", "quantity": 1, "sale_price": 5}).json()
        created_products.append(acc["id"])
        r = post_sale(s, [{"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTFIRST1"},
                          {"product_id": acc["id"], "quantity": 3, "sale_price": 5}])
        assert r.status_code == 400 and "pamjaftueshme" in r.json()["detail"]
        g = getp(s, ph["id"])
        assert g["quantity"] == 1 and g["imeis"][0]["status"] == "in_stock"

    def test_same_accessory_two_rows_sum(self, s):
        acc = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_IMEI_acc4", "type": "accessory", "quantity": 3, "sale_price": 5}).json()
        created_products.append(acc["id"])
        r = post_sale(s, [{"product_id": acc["id"], "quantity": 2, "sale_price": 5}, {"product_id": acc["id"], "quantity": 2, "sale_price": 5}])
        assert r.status_code == 400 and "pamjaftueshme" in r.json()["detail"]
        assert getp(s, acc["id"])["quantity"] == 3
        r = post_sale(s, [{"product_id": acc["id"], "quantity": 2, "sale_price": 5}, {"product_id": acc["id"], "quantity": 1, "sale_price": 5}])
        assert r.status_code == 200, r.text
        assert getp(s, acc["id"])["quantity"] == 0

    def test_mixed_registered_and_unregistered(self, s):
        # qty 2, 1 registered IMEI -> one unknown IMEI allowed, second unknown rejected
        ph = mkprod(s, name="TEST_IMEI_mixed", imeis=["TESTMIX1"], quantity=2)
        mdb.products.update_one({"_id": ObjectId(ph["id"])}, {"$set": {"quantity": 2}})  # create forces qty=len(imeis)
        r = post_sale(s, [{"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTNEWA"},
                          {"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTNEWB"}])
        assert r.status_code == 400 and "nuk është në stok" in r.json()["detail"]
        assert getp(s, ph["id"])["quantity"] == 2
        r = post_sale(s, [{"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTMIX1"},
                          {"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTNEWA"}])
        assert r.status_code == 200, r.text
        g = getp(s, ph["id"])
        assert g["quantity"] == 0 and all(x["status"] == "sold" for x in g["imeis"]) and len(g["imeis"]) == 2

    def test_valid_phone_plus_accessory_and_return(self, s):
        ph = mkprod(s, name="TEST_IMEI_valid", imeis=["TESTVAL1"], quantity=1)
        acc = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_IMEI_acc5", "type": "accessory", "quantity": 4, "sale_price": 5}).json()
        created_products.append(acc["id"])
        r = post_sale(s, [{"product_id": ph["id"], "quantity": 1, "sale_price": 150, "imei": "TESTVAL1"},
                          {"product_id": acc["id"], "quantity": 2, "sale_price": 5}])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 160 and d["items"][0]["imei"] == "TESTVAL1"
        assert getp(s, acc["id"])["quantity"] == 2 and getp(s, ph["id"])["quantity"] == 0
        rr = s.post(f"{BASE_URL}/api/sales/{d['id']}/return", json={"items": [{"index": 0, "quantity": 1}, {"index": 1, "quantity": 2}], "reason": "TEST"})
        assert rr.status_code == 200, rr.text
        assert getp(s, acc["id"])["quantity"] == 4
        g = getp(s, ph["id"])
        assert g["quantity"] == 1 and g["imeis"][0]["status"] == "in_stock"
