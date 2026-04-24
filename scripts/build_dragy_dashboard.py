from __future__ import annotations

import html
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen, urlretrieve


ROOT = Path("/Users/jasonjiajunxu/Documents/New project/github-pages-dashboard")
DATA_DIR = ROOT / "data"
SITE_DIR = ROOT / "site"
IMAGE_PATH = SITE_DIR / "assets" / "products" / "dragy.jpg"
OUTPUT_PATH = DATA_DIR / "dragy_dashboard.json"
CONFIG_PATH = Path("/Users/jasonjiajunxu/.codex/config.toml")

MARKETS = ["US", "UK", "DE", "FR", "IT", "ES", "CA", "JP", "AU"]
MARKET_LABELS = {
    "US": "美国",
    "UK": "英国",
    "DE": "德国",
    "FR": "法国",
    "IT": "意大利",
    "ES": "西班牙",
    "CA": "加拿大",
    "JP": "日本",
    "AU": "澳大利亚",
}


def load_secret_key() -> str:
    content = CONFIG_PATH.read_text(encoding="utf-8")
    match = re.search(r'"secret-key"\s*=\s*"([^"]+)"', content)
    if match:
        return match.group(1)
    raise RuntimeError("SellerSprite secret-key not found in config.toml")


def call_tool(secret_key: str, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": name,
            "arguments": arguments,
        },
    }
    req = Request(
        "https://mcp.sellersprite.com/mcp",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "secret-key": secret_key,
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
        },
    )
    with urlopen(req, timeout=60) as response:
        outer = json.loads(response.read().decode("utf-8"))
    text = outer["result"]["content"][0]["text"]
    return json.loads(text)


def normalize_title(title: str) -> str:
    return html.unescape(title).replace("  ", " ").strip()


def is_main_unit(item: dict[str, Any]) -> bool:
    title = normalize_title(item.get("title", "")).lower()
    main_signals = [
        "dragy pro",
        "performance meter",
        "leistungsmesser",
        "misuratore di prestazioni",
        "compteur de performance",
        "gps based performance meter",
        "gps-basiertes leistungsmessgerät",
    ]
    if any(token in title for token in main_signals):
        return "refurbished" not in title

    accessory_signals = ["official mount", "finestra a ventosa", "suction cup", "supporto", "halterung", "soporte"]
    return not any(token in title for token in accessory_signals)


def clamp_daily_row(row: dict[str, Any]) -> dict[str, Any]:
    sales = max(0, int(row.get("sales", 0)))
    amount = max(0, int(row.get("amount", 0)))
    price = max(0, int(row.get("price", 0)))
    bsr = row.get("bsr", 0)
    bsr_value = None if bsr in (-1, None) else int(bsr)
    return {
        "date": row["date"],
        "sales": sales,
        "amount": amount,
        "price": price,
        "bsr": bsr_value,
    }


def build() -> None:
    secret_key = load_secret_key()
    brand_results: dict[str, list[dict[str, Any]]] = {}

    for marketplace in MARKETS:
        payload = call_tool(
            secret_key,
            "competitor_lookup",
            {
                "request": {
                    "brand": "dragy",
                    "marketplace": marketplace,
                    "page": 1,
                    "size": 20,
                    "variation": "Y",
                    "order": {"field": "total_units", "desc": True},
                }
            },
        )
        data = payload.get("data") or {}
        brand_results[marketplace] = data.get("items") or []

    main_products: list[dict[str, Any]] = []
    accessory_products: list[dict[str, Any]] = []

    for marketplace, items in brand_results.items():
        for item in items:
            enriched = {
                "marketplace": marketplace,
                "country": MARKET_LABELS[marketplace],
                "asin": item["asin"],
                "title": normalize_title(item["title"]),
                "imageUrl": item.get("imageUrl", ""),
                "price": item.get("price") or 0,
                "monthlyUnits": item.get("units") or 0,
                "monthlyRevenue": item.get("revenue") or 0,
                "rating": item.get("rating") or 0,
                "ratings": item.get("ratings") or 0,
                "sellerName": item.get("sellerName") or "",
                "isMainUnit": is_main_unit(item),
            }
            if enriched["isMainUnit"]:
                main_products.append(enriched)
            else:
                accessory_products.append(enriched)

    asin_predictions: dict[tuple[str, str], dict[str, Any]] = {}
    for product in main_products + accessory_products:
        key = (product["marketplace"], product["asin"])
        if key in asin_predictions:
            continue
        prediction = call_tool(
            secret_key,
            "asin_prediction",
            {"asin": product["asin"], "marketplace": product["marketplace"]},
        )
        asin_predictions[key] = prediction.get("data") or {}

    if main_products:
        top_image_url = max(main_products, key=lambda item: item["monthlyUnits"]).get("imageUrl")
        if top_image_url:
            IMAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
            urlretrieve(top_image_url, IMAGE_PATH)

    country_daily: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {"sales": 0, "amount": 0}))
    country_bsr: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))

    for product in main_products:
        prediction = asin_predictions[(product["marketplace"], product["asin"])]
        rows = [clamp_daily_row(row) for row in (prediction.get("dailyItemList") or [])]
        window = rows[-30:]
        product["dailyWindow"] = window
        for row in window:
            country_daily[product["marketplace"]][row["date"]]["sales"] += row["sales"]
            country_daily[product["marketplace"]][row["date"]]["amount"] += row["amount"]
            if row["bsr"] is not None:
                country_bsr[product["marketplace"]][row["date"]].append(row["bsr"])

    all_dates = sorted({date for per_market in country_daily.values() for date in per_market.keys()})
    latest_date = all_dates[-1] if all_dates else ""
    latest_dt = datetime.strptime(latest_date, "%Y-%m-%d") if latest_date else datetime.now()
    generated_at = latest_dt.strftime("%Y/%m/%d 12:00")

    daily_rows: list[dict[str, Any]] = []
    for date in all_dates:
        countries = {}
        global_sales = 0
        global_amount = 0
        for marketplace in MARKETS:
            sales = country_daily[marketplace][date]["sales"]
            amount = country_daily[marketplace][date]["amount"]
            avg_price = round(amount / sales) if sales else 0
            bsr_values = country_bsr[marketplace][date]
            countries[marketplace] = {
                "sales": sales,
                "amount": amount,
                "price": avg_price,
                "bsr": min(bsr_values) if bsr_values else None,
            }
            global_sales += sales
            global_amount += amount
        daily_rows.append(
            {
                "date": date,
                "globalSales": global_sales,
                "globalAmount": global_amount,
                "countries": countries,
            }
        )

    country_summary: list[dict[str, Any]] = []
    for marketplace in MARKETS:
        products = [item for item in main_products if item["marketplace"] == marketplace]
        accessory = [item for item in accessory_products if item["marketplace"] == marketplace]
        sales_30d = sum(row["countries"][marketplace]["sales"] for row in daily_rows)
        amount_30d = sum(row["countries"][marketplace]["amount"] for row in daily_rows)
        latest_sales = daily_rows[-1]["countries"][marketplace]["sales"] if daily_rows else 0
        latest_amount = daily_rows[-1]["countries"][marketplace]["amount"] if daily_rows else 0
        avg_price = round(amount_30d / sales_30d) if sales_30d else 0
        country_summary.append(
            {
                "marketplace": marketplace,
                "country": MARKET_LABELS[marketplace],
                "trackedProducts": len(products),
                "accessoryProducts": len(accessory),
                "totalSales30d": sales_30d,
                "totalAmount30d": amount_30d,
                "avgPrice30d": avg_price,
                "latestSales": latest_sales,
                "latestAmount": latest_amount,
                "monthlyUnits": sum(item["monthlyUnits"] for item in products + accessory),
                "monthlyRevenue": sum(item["monthlyRevenue"] for item in products + accessory),
                "products": products,
                "accessories": accessory,
            }
        )

    payload = {
        "brand": "dragy",
        "title": "dragy 全球近 30 天销量看板",
        "generatedAt": generated_at,
        "latestDate": latest_date,
        "windowStart": all_dates[0] if all_dates else "",
        "windowEnd": latest_date,
        "heroImage": "./assets/products/dragy.jpg",
        "dailyRows": daily_rows,
        "countrySummary": country_summary,
        "trackedProducts": main_products,
        "accessoryProducts": accessory_products,
        "notes": [
            "本页的近 30 天日销量按 dragy 主机型汇总，配件与翻新品单独列在覆盖清单里。",
            "国家图表展示的是各站点品牌主机型的日销量总和，方便先看全球分布和国家强弱。",
            "日本和澳大利亚当前未检索到 dragy 品牌在售产品，因此暂时只作为空白市场观察。"
        ],
    }

    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
