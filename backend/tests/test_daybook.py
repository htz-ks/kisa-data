# Qarkullimet Ditore (daybook) API regression tests.
# Uses far-future dates (2099) for manual entries/overrides/counts; restores settings to the original values at the end.
import os
from pathlib import Path

import pytest
import requests

FE_ENV = dict(l.split("=", 1) for l in Path("/app/frontend/.env").read_text().splitlines() if "=" in l)
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE_ENV["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"
REAL_SETTINGS = {"start_date": "2026-10-20", "opening_cash": 1000}


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@prodata.al", "admin123")


@pytest.fixture(scope="module")
def future(admin):
    """Temporarily move cash start to 2099-01-01 / 500; always restore real settings."""
    orig = admin.get(f"{API}/daybook/settings").json()
    r = admin.put(f"{API}/daybook/settings", json={"start_date": "2099-01-01", "opening_cash": 500})
    assert r.status_code == 200 and r.json()["start_date"] == "2099-01-01"
    created = {"manual": [], "expense": [], "override": []}
    yield created
    for k in created["override"]:
        admin.delete(f"{API}/daybook/override", params={"key": k})
    for mid in created["manual"]:
        admin.delete(f"{API}/daybook/manual/{mid}", json={"reason": "TEST cleanup"})
    for eid in created["expense"]:
        admin.delete(f"{API}/expenses/{eid}")
    admin.put(f"{API}/daybook/settings", json=REAL_SETTINGS)
    print("original settings were", orig)


def day(s, d):
    r = s.get(f"{API}/daybook/day", params={"date": d})
    assert r.status_code == 200, r.text
    return r.json()


# ---- access control ----
class TestAccess:
    def test_employee_forbidden(self):
        emp = _login("punonjes@prodata.al", "punonjes123")
        for path in ("/daybook/day?date=2026-10-20", "/daybook/settings", "/daybook/report?date_from=2026-10-01&date_to=2026-10-31", "/daybook/audit"):
            assert emp.get(f"{API}{path}").status_code in (401, 403), path

    def test_invalid_date(self, admin):
        assert admin.get(f"{API}/daybook/day", params={"date": "2026-13-40"}).status_code == 400
        assert admin.get(f"{API}/daybook/report", params={"date_from": "2026-10-31", "date_to": "2026-10-01"}).status_code == 400


# ---- real data (read only) ----
class TestRealData:
    def test_settings_real(self, admin):
        st = admin.get(f"{API}/daybook/settings").json()
        assert st["start_date"] == "2026-10-20" and st["opening_cash"] == 1000

    def test_day_structure_and_no_duplicates(self, admin):
        for d in ("2026-10-20", "2026-10-21"):
            data = day(admin, d)
            for k in ("entries", "summary", "opening_cash", "closing_cash"):
                assert k in data
            keys = [e["key"] for e in data["entries"]]
            assert len(keys) == len(set(keys)), f"duplicate keys on {d}"
            s = data["summary"]
            cin = round(sum(e["hyrje"] for e in data["entries"] if e["method"] == "cash"), 2)
            cout = round(sum(e["dalje"] for e in data["entries"] if e["method"] == "cash"), 2)
            assert abs(s["cash_in"] - cin) < 0.01 and abs(s["cash_out"] - cout) < 0.01
            assert abs(data["closing_cash"] - (data["opening_cash"] + cin - cout)) < 0.01
            print(d, len(keys), "entries", data["opening_cash"], "->", data["closing_cash"], "profit", s["net_profit"], "incomplete", s["profit_incomplete"])

    def test_carry_over_real(self, admin):
        d20, d21, d22 = day(admin, "2026-10-20"), day(admin, "2026-10-21"), day(admin, "2026-10-22")
        assert d20["opening_cash"] == 1000
        assert d20["closing_cash"] == d21["opening_cash"]
        assert d21["closing_cash"] == d22["opening_cash"]
        assert day(admin, "2026-10-19")["opening_cash"] is None

    def test_report_totals_real(self, admin):
        p = {"date_from": "2026-10-15", "date_to": "2026-10-31", "group": "day"}
        rep = admin.get(f"{API}/daybook/report", params=p).json()
        rows = {r["period"]: r for r in rep["rows"]}
        for d in ("2026-10-20", "2026-10-21"):
            ds = day(admin, d)
            assert abs(rows[d]["net_profit"] - ds["summary"]["net_profit"]) < 0.01
            assert rows[d]["cash_end"] == ds["closing_cash"]
        for k in ("sales_total", "cash_in", "cash_out", "net_profit"):
            assert abs(rep["totals"][k] - sum(r[k] for r in rep["rows"])) < 0.02
        m = admin.get(f"{API}/daybook/report", params={**p, "group": "month"}).json()
        assert len(m["rows"]) == 1 and abs(m["totals"]["net_profit"] - rep["totals"]["net_profit"]) < 0.02
        y = admin.get(f"{API}/daybook/report", params={**p, "group": "year"}).json()
        assert y["rows"][0]["period"] == "2026"

    def test_exports(self, admin):
        p = {"date_from": "2026-10-01", "date_to": "2026-10-31", "group": "day"}
        x = admin.get(f"{API}/daybook/report.xlsx", params=p)
        assert x.status_code == 200 and x.content[:2] == b"PK"
        pdf = admin.get(f"{API}/daybook/report.pdf", params=p)
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"

    def test_override_real_sale_and_restore(self, admin):
        D0, D1 = "2026-10-21", "2026-10-22"
        d = day(admin, D0)
        sale = next((e for e in d["entries"] if e["source"] == "sale" and e["method"] == "cash" and e["hyrje"] > 0), None)
        if not sale:
            pytest.skip("no cash sale on 2026-10-20")
        key, orig = sale["key"], sale["hyrje"]
        try:
            r = admin.put(f"{API}/daybook/override", json={"key": key, "hyrje": orig + 10, "method": "cash", "reason": "TEST"})
            assert r.status_code == 200
            d2 = day(admin, D0)
            e2 = next(e for e in d2["entries"] if e["key"] == key)
            assert e2["corrected"] and e2["hyrje"] == round(orig + 10, 2)
            assert abs(d2["closing_cash"] - d["closing_cash"] - 10) < 0.01
            assert abs(day(admin, D1)["opening_cash"] - d2["closing_cash"]) < 0.01
            ent = admin.get(f"{API}/daybook/entry", params={"key": key}).json()
            assert ent["corrected"] and ent["hyrje"] == round(orig + 10, 2)
        finally:
            assert admin.delete(f"{API}/daybook/override", params={"key": key}).status_code == 200
        d3 = day(admin, D0)
        assert d3["closing_cash"] == d["closing_cash"]
        assert not next(e for e in d3["entries"] if e["key"] == key)["corrected"]
        assert any(a["action"] == "restore" for a in admin.get(f"{API}/daybook/audit", params={"key": key}).json())


# ---- future dates: manual entries, overrides, counts, carry-over ----
class TestFuture:
    def test_before_start(self, admin, future):
        assert day(admin, "2098-12-31")["opening_cash"] is None
        assert day(admin, "2099-01-01")["opening_cash"] == 500

    def test_manual_entries(self, admin, future):
        base = day(admin, "2099-01-10")
        assert base["opening_cash"] == 500
        mk = lambda **kw: admin.post(f"{API}/daybook/manual", json={"date": "2099-01-10", "description": "TEST_manual", **kw})  # noqa: E731
        r1 = mk(kind="in", amount=100, method="cash", in_profit=True)
        r2 = mk(kind="out", amount=50, method="bank", in_profit=False)
        r3 = mk(kind="out", amount=30, method="cash", in_profit=False)
        for r in (r1, r2, r3):
            assert r.status_code == 200, r.text
            future["manual"].append(r.json()["id"])
        assert mk(kind="in", amount=0).status_code == 400
        d = day(admin, "2099-01-10")
        assert d["closing_cash"] == 570
        assert d["summary"]["bank_out"] == 50 and d["summary"]["cash_out"] == 30
        assert d["summary"]["net_profit"] == 100
        assert day(admin, "2099-01-11")["opening_cash"] == 570
        # edit
        mid = r1.json()["id"]
        e = admin.put(f"{API}/daybook/manual/{mid}", json={"date": "2099-01-10", "kind": "in", "amount": 120, "method": "cash", "description": "TEST_edit", "in_profit": False})
        assert e.status_code == 200
        d = day(admin, "2099-01-10")
        assert d["closing_cash"] == 590 and d["summary"]["net_profit"] == 0
        # soft delete
        mid3 = r3.json()["id"]
        assert admin.delete(f"{API}/daybook/manual/{mid3}", json={"reason": " "}).status_code == 400
        assert admin.delete(f"{API}/daybook/manual/{mid3}").status_code == 422
        assert admin.delete(f"{API}/daybook/manual/{mid3}", json={"reason": "TEST reason"}).status_code == 200
        future["manual"].remove(mid3)
        d = day(admin, "2099-01-10")
        assert d["closing_cash"] == 620 and f"manual:{mid3}" not in [x["key"] for x in d["entries"]]
        aud = admin.get(f"{API}/daybook/audit", params={"key": f"manual:{mid3}"}).json()
        assert any(a["action"] == "delete" and a["reason"] == "TEST reason" for a in aud)

    def test_expense_override(self, admin, future):
        r = admin.post(f"{API}/expenses", json={"category": "TEST", "amount": 40, "date": "2099-01-11", "description": "TEST_daybook"})
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        future["expense"].append(eid)
        key = f"expense:{eid}"
        d = day(admin, "2099-01-11")
        ents = [x for x in d["entries"] if x["key"] == key]
        assert len(ents) == 1 and ents[0]["dalje"] == 40
        before_close, before_next = d["closing_cash"], day(admin, "2099-01-12")["opening_cash"]
        assert before_close == before_next
        future["override"].append(key)
        assert admin.put(f"{API}/daybook/override", json={"key": key, "dalje": 25, "method": "cash", "reason": "TEST"}).status_code == 200
        d2 = day(admin, "2099-01-11")
        assert d2["closing_cash"] == before_close + 15
        assert day(admin, "2099-01-12")["opening_cash"] == before_close + 15
        assert next(x for x in d2["entries"] if x["key"] == key)["corrected"]
        # bank method -> not in cash
        admin.put(f"{API}/daybook/override", json={"key": key, "method": "bank", "reason": "TEST"})
        d3 = day(admin, "2099-01-11")
        assert d3["closing_cash"] == before_close + 40 and d3["summary"]["bank_out"] == 25
        assert admin.put(f"{API}/daybook/override", json={"key": "manual:abc", "dalje": 1}).status_code == 400
        assert admin.put(f"{API}/daybook/override", json={"key": key, "dalje": -1}).status_code == 400
        admin.delete(f"{API}/daybook/override", params={"key": key})
        assert day(admin, "2099-01-11")["closing_cash"] == before_close

    def test_cash_count(self, admin, future):
        counts = {"100": 3, "50": 5, "20": 4, "10": 2, "0.5": 3, "0.2": 2, "0.1": 1}
        r = admin.put(f"{API}/daybook/count/2099-01-12", json={"counts": counts})
        assert r.status_code == 200 and r.json()["total"] == 652.0
        before = day(admin, "2099-01-12")
        assert before["count"]["total"] == 652.0
        assert abs(before["count"]["difference"] - (652 - before["closing_cash"])) < 0.01
        # count does not change accounting cash
        assert before["closing_cash"] == before["opening_cash"] + before["summary"]["cash_in"] - before["summary"]["cash_out"]

    def test_future_report(self, admin, future):
        rep = admin.get(f"{API}/daybook/report", params={"date_from": "2099-01-01", "date_to": "2099-01-31", "group": "day"}).json()
        assert len(rep["rows"]) == 31
        rows = {r["period"]: r for r in rep["rows"]}
        assert rows["2099-01-12"]["cash_end"] == day(admin, "2099-01-12")["closing_cash"]
        assert rows["2099-01-12"]["counted_days"] == 1
        yr = admin.get(f"{API}/daybook/report", params={"date_from": "2099-01-01", "date_to": "2099-12-31", "group": "month"}).json()
        assert len(yr["rows"]) == 12
