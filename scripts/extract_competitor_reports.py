from __future__ import annotations

import ast
import csv
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path("/Users/jasonjiajunxu/Documents/New project/metabase_dashboard_pack")
SOURCE_HTML = Path("/Users/jasonjiajunxu/Desktop/04.10竞品调研.html")
DATA_DIR = ROOT / "data"


REPORT_BLOCK_RE = re.compile(
    r'<section class="report" id="(?P<id>[^"]+)"(?P<attrs>[^>]*)>(?P<section>.*?)</section>\s*<script>(?P<script>.*?)</script>',
    re.S,
)
TEXT_RE = re.compile(r"<[^>]+>")


def clean_html(text: str) -> str:
    return re.sub(r"\s+", " ", TEXT_RE.sub("", text)).strip()


def parse_js_array(raw: str) -> list[Any]:
    value = ast.literal_eval(raw)
    return list(value)


def parse_numberish(value: str) -> float | None:
    cleaned = (
        value.replace(",", "")
        .replace("$", "")
        .replace("€", "")
        .replace("£", "")
        .replace("件", "")
        .replace("国", "")
        .replace("款", "")
        .replace("年", "")
        .replace("月", "")
        .replace("reviews", "")
        .replace("review", "")
        .replace("★", "")
        .replace("~", "")
        .strip()
    )
    mult = 1.0
    if cleaned.endswith("M"):
        mult = 1_000_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("K"):
        mult = 1_000
        cleaned = cleaned[:-1]
    elif cleaned.endswith("×"):
        cleaned = cleaned[:-1]
    cleaned = cleaned.strip()
    if not cleaned:
        return None
    try:
        return round(float(cleaned) * mult, 2)
    except ValueError:
        return None


def extract_cards(html: str) -> list[dict[str, Any]]:
    cards = []
    card_re = re.compile(
        r'<div class="card" data-report="(?P<report_id>[^"]+)"(?P<attrs>[^>]*)>.*?'
        r'<div class="card-brand">(?P<brand>.*?)</div>.*?'
        r'<div class="card-title">(?P<title>.*?)</div>.*?'
        r'<div class="card-meta">(?P<meta>.*?)</div>.*?'
        r'<div class="card-desc">(?P<desc>.*?)</div>.*?'
        r'<div class="cstat"><div class="cstat-val">(?P<stat_1_value>.*?)</div><div class="cstat-label">(?P<stat_1_label>.*?)</div></div>.*?'
        r'<div class="cstat"><div class="cstat-val">(?P<stat_2_value>.*?)</div><div class="cstat-label">(?P<stat_2_label>.*?)</div></div>',
        re.S,
    )
    for match in card_re.finditer(html):
        cards.append(
            {
                "report_id": match.group("report_id"),
                "brand_line": clean_html(match.group("brand")),
                "card_title": clean_html(match.group("title")),
                "card_meta": clean_html(match.group("meta")),
                "card_description": clean_html(match.group("desc")),
                "headline_metric_1_label": clean_html(match.group("stat_1_label")),
                "headline_metric_1_value": clean_html(match.group("stat_1_value")),
                "headline_metric_2_label": clean_html(match.group("stat_2_label")),
                "headline_metric_2_value": clean_html(match.group("stat_2_value")),
            }
        )
    return cards


def extract_reports(html: str) -> dict[str, Any]:
    card_lookup = {card["report_id"]: card for card in extract_cards(html)}
    reports = []
    hero_stats = []
    kpis = []
    monthly_series = []
    insights = []

    for match in REPORT_BLOCK_RE.finditer(html):
        report_id = match.group("id")
        attrs = match.group("attrs")
        section = match.group("section")
        script = match.group("script")
        color_match = re.search(r"--rep-color:([^;\"']+)", attrs)
        report_color = color_match.group(1).strip() if color_match else "#3a86ff"
        brand = clean_html(re.search(r"<text[^>]*>(.*?)</text>", section, re.S).group(1))
        brand_since = clean_html(re.search(r'<span class="brand-since">(.*?)</span>', section, re.S).group(1))
        report_label = clean_html(re.search(r'<div class="report-label">(.*?)</div>', section, re.S).group(1))
        title_match = re.search(r"<h1>(.*?)<span>(.*?)</span></h1>", section, re.S)
        title = clean_html(title_match.group(1))
        subtitle = clean_html(title_match.group(2))
        asin_block = re.search(r'<div class="report-asin">(.*?)</div>', section, re.S).group(1)
        asin_text = clean_html(asin_block)
        asins = re.findall(r"\b[A-Z0-9]{10}\b", asin_text)
        img_match = re.search(r'<img src="([^"]+)"', section)
        image_url = img_match.group(1) if img_match else ""
        product_tag = clean_html(re.search(r'<div class="product-tag">(.*?)</div>', section, re.S).group(1))

        report_row = {
            "report_id": report_id,
            "brand": brand,
            "brand_since": brand_since,
            "report_label": report_label,
            "title": title,
            "subtitle": subtitle,
            "asin_text": asin_text,
            "primary_asin": asins[0] if asins else "",
            "asin_count": len(asins),
            "image_url": image_url,
            "product_tag": product_tag,
            "theme_color": report_color,
        }
        report_row.update(card_lookup.get(report_id, {}))
        reports.append(report_row)

        for idx, stat_match in enumerate(
            re.finditer(
                r'<div><div class="hero-stat-val">(.*?)</div><div class="hero-stat-label">(.*?)</div></div>',
                section,
                re.S,
            ),
            start=1,
        ):
            value_text = clean_html(stat_match.group(1))
            label = clean_html(stat_match.group(2))
            hero_stats.append(
                {
                    "report_id": report_id,
                    "position": idx,
                    "label": label,
                    "value_text": value_text,
                    "value_numeric": parse_numberish(value_text),
                }
            )

        for idx, kpi_match in enumerate(
            re.finditer(
                r'<div class="kpi"><div class="kpi-value">(.*?)</div><div class="kpi-label">(.*?)</div><div class="kpi-sub([^"]*)">(.*?)</div></div>',
                section,
                re.S,
            ),
            start=1,
        ):
            value_text = clean_html(kpi_match.group(1))
            label = clean_html(kpi_match.group(2))
            subtext = clean_html(kpi_match.group(4))
            tone = "warn" if "warn" in kpi_match.group(3) else "default"
            kpis.append(
                {
                    "report_id": report_id,
                    "position": idx,
                    "label": label,
                    "value_text": value_text,
                    "value_numeric": parse_numberish(value_text),
                    "subtext": subtext,
                    "tone": tone,
                }
            )

        for idx, insight_match in enumerate(
            re.finditer(r'<div class="insight">.*?<h4>(.*?)</h4><p>(.*?)</p></div>', section, re.S),
            start=1,
        ):
            insights.append(
                {
                    "report_id": report_id,
                    "position": idx,
                    "title": clean_html(insight_match.group(1)),
                    "body": clean_html(insight_match.group(2)),
                }
            )

        script_arrays: dict[str, list[Any]] = {}
        for array_name, array_raw in re.findall(r"const\s+([A-Za-z0-9_]+)\s*=\s*(\[[^\n;]*\])\s*;", script):
            try:
                script_arrays[array_name] = parse_js_array(array_raw)
            except Exception:
                continue

        labels = script_arrays.get("M")
        if labels:
            for series_name, values in script_arrays.items():
                if series_name == "M":
                    continue
                if len(values) != len(labels) or not all(isinstance(v, (int, float)) for v in values):
                    continue
                metric_kind = "units"
                lower = series_name.lower()
                if "rev" in lower:
                    metric_kind = "revenue"
                elif "price" in lower:
                    metric_kind = "price"
                elif lower in {"us", "de", "uk", "fr", "ca", "c1", "c2", "mlm", "mlm2pro"}:
                    metric_kind = "segment_units"
                for period, value in zip(labels, values):
                    monthly_series.append(
                        {
                            "report_id": report_id,
                            "period_label": period,
                            "series_name": series_name,
                            "metric_kind": metric_kind,
                            "value": value,
                        }
                    )

    return {
        "reports": reports,
        "hero_stats": hero_stats,
        "kpis": kpis,
        "monthly_series": monthly_series,
        "insights": insights,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("")
        return
    fieldnames = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_dashboard_payload(parsed: dict[str, Any]) -> dict[str, Any]:
    hero_by_report: dict[str, list[dict[str, Any]]] = {}
    for row in parsed["hero_stats"]:
        hero_by_report.setdefault(row["report_id"], []).append(row)

    series_by_report: dict[str, list[dict[str, Any]]] = {}
    for row in parsed["monthly_series"]:
        series_by_report.setdefault(row["report_id"], []).append(row)

    insights_by_report: dict[str, list[dict[str, Any]]] = {}
    for row in parsed["insights"]:
        insights_by_report.setdefault(row["report_id"], []).append(row)

    reports_payload = []
    for report in parsed["reports"]:
        report_id = report["report_id"]
        headline_sales = next(
            (
                item["value_numeric"]
                for item in hero_by_report.get(report_id, [])
                if item["value_numeric"] is not None and "销量" in item["label"]
            ),
            None,
        )
        headline_revenue = next(
            (
                item["value_numeric"]
                for item in hero_by_report.get(report_id, [])
                if item["value_numeric"] is not None and "销售额" in item["label"]
            ),
            None,
        )
        reports_payload.append(
            {
                **report,
                "headline_sales": headline_sales,
                "headline_revenue": headline_revenue,
                "hero_stats": hero_by_report.get(report_id, []),
                "series": series_by_report.get(report_id, []),
                "insights": insights_by_report.get(report_id, []),
            }
        )

    return {
        "generated_from": str(SOURCE_HTML),
        "report_count": len(reports_payload),
        "series_count": len(parsed["monthly_series"]),
        "reports": reports_payload,
    }


def main() -> None:
    html = SOURCE_HTML.read_text(encoding="utf-8")
    parsed = extract_reports(html)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    write_csv(DATA_DIR / "reports.csv", parsed["reports"])
    write_csv(DATA_DIR / "hero_stats.csv", parsed["hero_stats"])
    write_csv(DATA_DIR / "kpis.csv", parsed["kpis"])
    write_csv(DATA_DIR / "monthly_series.csv", parsed["monthly_series"])
    write_csv(DATA_DIR / "insights.csv", parsed["insights"])

    dashboard_payload = build_dashboard_payload(parsed)
    (DATA_DIR / "dashboard.json").write_text(
        json.dumps(dashboard_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
