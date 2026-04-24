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
INLINE_JS_PATH = SITE_DIR / "dragy-data.js"
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
MAP_POSITIONS = {
    "US": {"x": 18, "y": 42},
    "CA": {"x": 18, "y": 24},
    "UK": {"x": 45, "y": 29},
    "DE": {"x": 49, "y": 31},
    "FR": {"x": 46, "y": 35},
    "IT": {"x": 51, "y": 40},
    "ES": {"x": 43, "y": 39},
    "JP": {"x": 82, "y": 35},
    "AU": {"x": 84, "y": 73},
}
LINE_META = {
    "global": {
        "id": "global",
        "name": "Global",
        "label": "全球总览",
        "description": "把 5 个 dragy 产品组放在一起看，先判断品牌整体体量，再往下拆具体产品线。",
        "color": "#111827",
    },
    "dragy_pro": {
        "id": "dragy_pro",
        "name": "dragy Pro",
        "label": "旗舰款",
        "description": "新一代 25Hz 旗舰款，适合优先看高客单价和多国家铺货后的全球表现。",
        "color": "#e63946",
    },
    "dragy": {
        "id": "dragy",
        "name": "dragy",
        "label": "DRG70-C 正价款",
        "description": "这里的 dragy 只指 DRG70-C 正价款，不包含旧款 DRG69，适合和 Pro 对比看核心主销型号体量。",
        "color": "#5d84f1",
    },
    "dragy_pro_refurbished": {
        "id": "dragy_pro_refurbished",
        "name": "dragy Pro Refurbished",
        "label": "旗舰翻新款",
        "description": "dragy Pro 的 Refurbished 版本，适合和全新 Pro 对比看价格换销量是否成立。",
        "color": "#8f5cff",
    },
    "dragy_refurbished": {
        "id": "dragy_refurbished",
        "name": "dragy Refurbished",
        "label": "DRG70-C 翻新款",
        "description": "这里只看 DRG70-C 的 Refurbished 版本，用来观察该主销型号翻新机的持续需求。",
        "color": "#6b7280",
    },
    "mount": {
        "id": "mount",
        "name": "dragy Mount",
        "label": "配件支架",
        "description": "官方吸盘支架，和主机不同，需要单独看附件型商品的销量波动。",
        "color": "#b38322",
    },
}
PRODUCT_SCOPE_IDS = (
    "dragy_pro",
    "dragy",
    "dragy_pro_refurbished",
    "dragy_refurbished",
    "mount",
)
ACCESSORY_TERMS = [
    "official dragy mount",
    "window suction cup mount",
    "suction cup mount",
    "mount compatible with dragy",
    "supporto a ventosa",
    "halterung für",
    "soporte de ventosa",
    "ventosa para",
]
PRODUCT_ASIN_MAP = {
    "B0DSV36JY9": "dragy_pro",
    "B0BQ95FSQ4": "dragy_pro_refurbished",
    "B0BQ648WBW": "dragy_refurbished",
    "B0BQ6DT2CV": "mount",
    "B0BQ6DWMLT": "dragy",
    "B0BQ9QT51G": "dragy",
}
EXCLUDED_ASINS = {
    "B077KKPMTB",
}
EXCLUDED_TITLE_TERMS = [
    "drg69",
    "2018 model",
]


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
        "params": {"name": name, "arguments": arguments},
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


def classify_product(asin: str, title: str) -> str:
    if asin in EXCLUDED_ASINS:
        return ""
    if asin in PRODUCT_ASIN_MAP:
        return PRODUCT_ASIN_MAP[asin]
    lower = normalize_title(title).lower()
    if any(term in lower for term in EXCLUDED_TITLE_TERMS):
        return ""
    if any(term in lower for term in ACCESSORY_TERMS):
        return "mount"
    if "refurbished" in lower and "dragy pro" in lower:
        return "dragy_pro_refurbished"
    if "refurbished" in lower:
        return "dragy_refurbished"
    if "dragy pro" in lower:
        return "dragy_pro"
    return "dragy"


def clamp_daily_row(row: dict[str, Any]) -> dict[str, Any]:
    sales = max(0, int(row.get("sales", 0)))
    amount = max(0, int(row.get("amount", 0)))
    price = max(0, int(row.get("price", 0)))
    bsr = row.get("bsr", 0)
    return {
        "date": row["date"],
        "sales": sales,
        "amount": amount,
        "price": price,
        "bsr": None if bsr in (-1, None) else int(bsr),
    }


def month_label(month: str) -> str:
    return f"{month[:4]}/{month[5:]}"


def product_key(product: dict[str, Any]) -> str:
    return f"{product['marketplace']}::{product['asin']}"


def aggregate_rows_by_date(products: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    date_map: dict[str, dict[str, Any]] = {}
    for product in products:
        for row in product["allRows"]:
            bucket = date_map.setdefault(
                row["date"],
                {
                    "date": row["date"],
                    "sales": 0,
                    "amount": 0,
                    "countries": defaultdict(lambda: {"sales": 0, "amount": 0}),
                    "lines": defaultdict(int),
                },
            )
            bucket["sales"] += row["sales"]
            bucket["amount"] += row["amount"]
            bucket["countries"][product["marketplace"]]["sales"] += row["sales"]
            bucket["countries"][product["marketplace"]]["amount"] += row["amount"]
            bucket["lines"][product["lineId"]] += row["sales"]
    return date_map


def serialize_daily_row(raw: dict[str, Any]) -> dict[str, Any]:
    countries = {}
    for marketplace in MARKETS:
        item = raw["countries"].get(marketplace) if isinstance(raw["countries"], dict) else None
        sales = item["sales"] if item else 0
        amount = item["amount"] if item else 0
        countries[marketplace] = {
            "sales": sales,
            "amount": amount,
            "price": round(amount / sales) if sales else 0,
        }
    return {
        "date": raw["date"],
        "sales": raw["sales"],
        "amount": raw["amount"],
        "price": round(raw["amount"] / raw["sales"]) if raw["sales"] else 0,
        "countries": countries,
        "lines": {line_id: raw["lines"].get(line_id, 0) for line_id in PRODUCT_SCOPE_IDS},
    }


def build_country_summary(
    rows: list[dict[str, Any]],
    products: list[dict[str, Any]],
    product_ids: set[str],
) -> list[dict[str, Any]]:
    summary = []
    for marketplace in MARKETS:
        sales = sum(row["countries"][marketplace]["sales"] for row in rows)
        amount = sum(row["countries"][marketplace]["amount"] for row in rows)
        market_products = [
            item
            for item in products
            if item["marketplace"] == marketplace and product_key(item) in product_ids
        ]
        summary.append(
            {
                "marketplace": marketplace,
                "country": MARKET_LABELS[marketplace],
                "sales": sales,
                "amount": amount,
                "avgPrice": round(amount / sales) if sales else 0,
                "productCount": len(market_products),
                "monthlyUnits": sum(item["monthlyUnits"] for item in market_products),
            }
        )
    return summary


def build_scope(
    scope_id: str,
    products: list[dict[str, Any]],
    global_recent_dates: list[str],
    last_twelve_months: list[str],
    all_products: list[dict[str, Any]],
) -> dict[str, Any]:
    date_map = aggregate_rows_by_date(products)
    product_ids = {product_key(item) for item in products}

    recent_rows = [
        serialize_daily_row(
            date_map.get(
                date,
                {"date": date, "sales": 0, "amount": 0, "countries": {}, "lines": defaultdict(int)},
            )
        )
        for date in global_recent_dates
    ]

    monthly_series = []
    month_drilldowns = {}
    for month in last_twelve_months:
        month_dates = sorted([date for date in date_map if date.startswith(month)])
        daily_rows = [serialize_daily_row(date_map[date]) for date in month_dates]
        month_sales = sum(row["sales"] for row in daily_rows)
        month_amount = sum(row["amount"] for row in daily_rows)
        monthly_series.append(
            {
                "month": month,
                "label": month_label(month),
                "sales": month_sales,
                "amount": month_amount,
            }
        )
        month_drilldowns[month] = {
            "month": month,
            "label": month_label(month),
            "sales": month_sales,
            "amount": month_amount,
            "dailyRows": daily_rows,
            "countrySummary": build_country_summary(daily_rows, all_products, product_ids),
        }

    recent_sales = sum(row["sales"] for row in recent_rows)
    recent_amount = sum(row["amount"] for row in recent_rows)
    line_products = []
    for product in products:
        recent30 = sum(row["sales"] for row in product["allRows"] if row["date"] in set(global_recent_dates))
        latest_month = last_twelve_months[-1] if last_twelve_months else ""
        latest_month_sales = sum(row["sales"] for row in product["allRows"] if row["date"].startswith(latest_month))
        line_products.append(
            {
                "asin": product["asin"],
                "marketplace": product["marketplace"],
                "country": product["country"],
                "title": product["title"],
                "imageUrl": product["imageUrl"],
                "price": product["price"],
                "rating": product["rating"],
                "ratings": product["ratings"],
                "sellerName": product["sellerName"],
                "recent30Sales": recent30,
                "currentMonthSales": latest_month_sales,
                "monthlyUnits": product["monthlyUnits"],
                "monthlyRevenue": product["monthlyRevenue"],
            }
        )

    latest_row = recent_rows[-1] if recent_rows else None
    active_countries = [item for item in build_country_summary(recent_rows, all_products, product_ids) if item["sales"] > 0]
    return {
        "id": scope_id,
        "meta": LINE_META[scope_id],
        "recent30": {
            "start": global_recent_dates[0] if global_recent_dates else "",
            "end": global_recent_dates[-1] if global_recent_dates else "",
            "sales": recent_sales,
            "amount": recent_amount,
            "avgPrice": round(recent_amount / recent_sales) if recent_sales else 0,
            "latestSales": latest_row["sales"] if latest_row else 0,
            "latestAmount": latest_row["amount"] if latest_row else 0,
            "dailyRows": recent_rows,
            "countrySummary": build_country_summary(recent_rows, all_products, product_ids),
        },
        "monthlySeries": monthly_series,
        "monthDrilldowns": month_drilldowns,
        "products": sorted(line_products, key=lambda item: (-item["recent30Sales"], item["country"])),
        "productCount": len(line_products),
        "activeCountryCount": len(active_countries),
        "heroImage": next((item["imageUrl"] for item in products if item.get("imageUrl")), ""),
    }


def build() -> None:
    secret_key = load_secret_key()
    all_products: list[dict[str, Any]] = []

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
                    "variation": "N",
                    "order": {"field": "total_units", "desc": True},
                }
            },
        )
        items = (payload.get("data") or {}).get("items") or []

        for item in items:
            title = normalize_title(item["title"])
            line_id = classify_product(item["asin"], title)
            if not line_id:
                continue
            enriched = {
                "asin": item["asin"],
                "marketplace": marketplace,
                "country": MARKET_LABELS[marketplace],
                "title": title,
                "imageUrl": item.get("imageUrl", ""),
                "price": item.get("price") or 0,
                "monthlyUnits": item.get("units") or 0,
                "monthlyRevenue": item.get("revenue") or 0,
                "rating": item.get("rating") or 0,
                "ratings": item.get("ratings") or 0,
                "sellerName": item.get("sellerName") or "",
                "lineId": line_id,
                "lineName": LINE_META.get(line_id, {}).get("name", "Other"),
            }
            all_products.append(enriched)

    asin_predictions: dict[tuple[str, str], dict[str, Any]] = {}
    for product in all_products:
        key = (product["marketplace"], product["asin"])
        if key in asin_predictions:
            continue
        prediction = call_tool(
            secret_key,
            "asin_prediction",
            {"asin": product["asin"], "marketplace": product["marketplace"]},
        )
        asin_predictions[key] = prediction.get("data") or {}

    for product in all_products:
        prediction = asin_predictions[(product["marketplace"], product["asin"])]
        product["allRows"] = [clamp_daily_row(row) for row in (prediction.get("dailyItemList") or [])]

    if all_products:
        top_product = max(all_products, key=lambda item: item["monthlyUnits"])
        if top_product.get("imageUrl"):
            IMAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
            urlretrieve(top_product["imageUrl"], IMAGE_PATH)

    all_dates = sorted(
        {
            row["date"]
            for product in all_products
            for row in product["allRows"]
            if row["sales"] > 0 or row["amount"] > 0
        }
    )
    recent_dates = all_dates[-30:]
    months = sorted({date[:7] for date in all_dates})
    last_twelve_months = months[-12:]
    latest_date = recent_dates[-1] if recent_dates else ""
    generated_at = (
        datetime.strptime(latest_date, "%Y-%m-%d").strftime("%Y/%m/%d 12:00")
        if latest_date
        else datetime.now().strftime("%Y/%m/%d %H:%M")
    )

    product_groups = {
        scope_id: [item for item in all_products if item["lineId"] == scope_id]
        for scope_id in PRODUCT_SCOPE_IDS
    }
    scopes = {"global": build_scope("global", all_products, recent_dates, last_twelve_months, all_products)}
    for scope_id in PRODUCT_SCOPE_IDS:
        scopes[scope_id] = build_scope(scope_id, product_groups[scope_id], recent_dates, last_twelve_months, all_products)

    months_overview = []
    for month in last_twelve_months:
        months_overview.append(
            {
                "id": month,
                "label": month_label(month),
                "globalSales": scopes["global"]["monthDrilldowns"][month]["sales"],
                "dragyProSales": scopes["dragy_pro"]["monthDrilldowns"][month]["sales"],
                "dragySales": scopes["dragy"]["monthDrilldowns"][month]["sales"],
                "dragyProRefurbishedSales": scopes["dragy_pro_refurbished"]["monthDrilldowns"][month]["sales"],
                "dragyRefurbishedSales": scopes["dragy_refurbished"]["monthDrilldowns"][month]["sales"],
                "mountSales": scopes["mount"]["monthDrilldowns"][month]["sales"],
            }
        )

    payload = {
        "brand": "dragy",
        "title": "dragy 全球销量看板",
        "generatedAt": generated_at,
        "latestDate": latest_date,
        "recent30Start": recent_dates[0] if recent_dates else "",
        "recent30End": latest_date,
        "defaultMonth": last_twelve_months[-1] if last_twelve_months else "",
        "heroImage": "./assets/products/dragy.jpg",
        "scopeOrder": ["global", *PRODUCT_SCOPE_IDS],
        "scopes": scopes,
        "months": months_overview,
        "mapPositions": MAP_POSITIONS,
        "notes": [
            "第一屏默认先看最近 30 天每天销量，避免用户一上来就被过多国家维度打散。",
            "这版已经按 5 个产品拆开：dragy Pro、dragy（仅 DRG70-C）、dragy Pro Refurbished、dragy Refurbished（仅 DRG70-C）、Mount。",
            "第三屏用近 12 个月月度条做入口，点击任意月份，下方会切到那个自然月的每天销量。",
            "地图和国家表会跟随当前产品与月份同步变化，既能看全球，也能看单国家贡献。"
        ],
        "accessories": [],
    }

    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    INLINE_JS_PATH.write_text(
        "window.__DRAGY_DASHBOARD_DATA__ = "
        + json.dumps(payload, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    build()
