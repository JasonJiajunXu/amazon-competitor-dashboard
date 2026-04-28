from __future__ import annotations

import importlib.util
import json
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path("/Users/jasonjiajunxu/Documents/New project/github-pages-dashboard")
DATA_DIR = ROOT / "data"
STATUS_PATH = DATA_DIR / "sellersprite_status.json"
DAILY_PATH = DATA_DIR / "sellersprite_daily.json"
REFRESH_PATH = DATA_DIR / "refresh_status.json"
DRAGY_SCRIPT = ROOT / "scripts" / "build_dragy_dashboard.py"
KEEP_DAYS = 14


def load_dragy_module():
    spec = importlib.util.spec_from_file_location("dragy_build", DRAGY_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load build_dragy_dashboard.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clamp_row(row: dict[str, Any]) -> dict[str, Any]:
    sales = max(0, int(row.get("sales", 0) or 0))
    amount = max(0, int(row.get("amount", 0) or 0))
    price = max(0, int(row.get("price", 0) or 0))
    bsr = row.get("bsr", 0)
    return {
        "date": row["date"],
        "sales": sales,
        "amount": amount,
        "price": price,
        "bsr": None if bsr in (-1, None) else int(bsr),
    }


def aggregate_report_rows(report_item_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "sales": 0,
            "amount": 0,
            "prices": [],
            "bsrs": [],
            "countries": defaultdict(lambda: {"sales": 0, "amount": 0, "prices": [], "bsrs": []}),
        }
    )
    for item_payload in report_item_rows:
        marketplace = item_payload["marketplace"]
        for row in item_payload["rows"]:
            bucket = buckets[row["date"]]
            bucket["sales"] += row["sales"]
            bucket["amount"] += row["amount"]
            if row["price"] > 0:
                bucket["prices"].append(row["price"])
            if row["bsr"] is not None:
                bucket["bsrs"].append(row["bsr"])
            country_bucket = bucket["countries"][marketplace]
            country_bucket["sales"] += row["sales"]
            country_bucket["amount"] += row["amount"]
            if row["price"] > 0:
                country_bucket["prices"].append(row["price"])
            if row["bsr"] is not None:
                country_bucket["bsrs"].append(row["bsr"])

    rows = []
    for date in sorted(buckets):
        bucket = buckets[date]
        avg_price = round(bucket["amount"] / bucket["sales"]) if bucket["sales"] else (round(sum(bucket["prices"]) / len(bucket["prices"])) if bucket["prices"] else 0)
        avg_bsr = round(sum(bucket["bsrs"]) / len(bucket["bsrs"])) if bucket["bsrs"] else None
        countries = {}
        for marketplace, country_bucket in bucket["countries"].items():
            country_price = round(country_bucket["amount"] / country_bucket["sales"]) if country_bucket["sales"] else (round(sum(country_bucket["prices"]) / len(country_bucket["prices"])) if country_bucket["prices"] else 0)
            country_bsr = round(sum(country_bucket["bsrs"]) / len(country_bucket["bsrs"])) if country_bucket["bsrs"] else None
            countries[marketplace] = {
                "sales": country_bucket["sales"],
                "amount": country_bucket["amount"],
                "price": country_price,
                "bsr": country_bsr,
            }
        rows.append(
            {
                "date": date,
                "sales": bucket["sales"],
                "amount": bucket["amount"],
                "price": avg_price,
                "bsr": avg_bsr,
                "countries": countries,
            }
        )
    return rows[-KEEP_DAYS:]


def iso_to_display(iso_value: str) -> str:
    parsed = datetime.fromisoformat(iso_value.replace("Z", "+00:00"))
    return parsed.astimezone().strftime("%Y/%m/%d %H:%M")


def resolve_now() -> datetime:
    override = os.environ.get("SYNC_NOW_ISO", "").strip()
    if override:
        return datetime.fromisoformat(override.replace("Z", "+00:00")).astimezone()
    return datetime.now().astimezone()


def main() -> int:
    status_payload = load_json(STATUS_PATH)
    daily_payload = load_json(DAILY_PATH)
    refresh_payload = load_json(REFRESH_PATH)

    dragy_module = load_dragy_module()
    secret_key = dragy_module.load_secret_key()

    now = resolve_now()
    display_time = now.strftime("%Y/%m/%d %H:%M")
    latest_snapshot_date = ""
    live_report_count = 0
    pending_report_count = 0
    configured_asin_count = 0

    next_daily_reports: dict[str, list[dict[str, Any]]] = {}

    for report_id, report in status_payload["reports"].items():
        report_item_rows: list[dict[str, Any]] = []
        fetched_any = False
        has_pending = False

        for item in report["items"]:
            asin = (item.get("asin") or "").strip()
            marketplace = (item.get("marketplace") or "").strip()
            if not asin or not marketplace:
                item["status"] = "pending_identifier"
                item["status_text"] = "Pending ID"
                has_pending = True
                continue

            configured_asin_count += 1
            response = dragy_module.call_tool(secret_key, "asin_prediction", {"asin": asin, "marketplace": marketplace})
            data = response.get("data") or {}
            raw_rows = data.get("dailyItemList") or []
            rows = [clamp_row(row) for row in raw_rows][-KEEP_DAYS:]
            report_item_rows.append({"marketplace": marketplace, "rows": rows})
            if rows:
                latest_item_date = rows[-1]["date"]
                latest_snapshot_date = max(latest_snapshot_date, latest_item_date)
                item["status"] = "live"
                item["status_text"] = "Live"
                item["note"] = f"最近一次日销量快照已更新到 {latest_item_date}。"
                fetched_any = True
            else:
                item["status"] = "configured"
                item["status_text"] = "Configured"
                item["note"] = "SellerSprite 已连通，但这次没有返回日销量记录。"

        report_rows = aggregate_report_rows(report_item_rows) if report_item_rows else []
        next_daily_reports[report_id] = report_rows

        if fetched_any:
            report["status"] = "live"
            report["sync_label"] = "已连通"
            live_report_count += 1
        elif has_pending:
            report["status"] = "pending_identifier"
            report["sync_label"] = "待补 ASIN"
            pending_report_count += 1
        else:
            report["status"] = "configured"
            report["sync_label"] = "已配置"

    daily_payload["latestSnapshotDate"] = latest_snapshot_date or daily_payload.get("latestSnapshotDate", "")
    daily_payload["reports"] = next_daily_reports

    status_payload["generatedAt"] = display_time

    refresh_payload["lastUpdated"] = display_time
    refresh_payload["sellerSprite"]["configuredAsins"] = configured_asin_count
    refresh_payload["sellerSprite"]["pendingReports"] = pending_report_count
    refresh_payload["sellerSprite"]["liveReports"] = live_report_count
    refresh_payload["sellerSprite"]["latestDailySnapshot"] = latest_snapshot_date
    refresh_payload["note"] = "月度历史数据继续保留；SellerSprite 已完成本轮日更，Racebox 保留站点月度历史，日销量快照同步到最近 14 天。"
    refresh_payload["logs"] = [
        {
            "time": display_time,
            "tag": "SellerSprite",
            "description": f"已完成 {live_report_count} 组已配置产品的日销量刷新，最新快照日期为 {latest_snapshot_date}。",
        },
        {
            "time": display_time,
            "tag": "Racebox",
            "description": "Racebox 日销量快照已更新到最近 14 天，站点月度历史继续保留在独立页面。",
        },
        {
            "time": display_time,
            "tag": "Dashboard",
            "description": "Bushnell、TAG、Rapsodo、Rangecraft、Blue Tees 等页面状态卡已同步最新 SellerSprite 快照。",
        },
        {
            "time": display_time,
            "tag": "Pending",
            "description": "Garmin Xero 仍缺 bundle ASIN，对应页面继续保持待补标记。",
        },
    ]

    dump_json(STATUS_PATH, status_payload)
    dump_json(DAILY_PATH, daily_payload)
    dump_json(REFRESH_PATH, refresh_payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
