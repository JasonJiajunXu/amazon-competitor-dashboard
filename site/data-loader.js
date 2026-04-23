function csvToObjects(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])),
  );
}

function maybeNumber(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}

function classifyReport(reportId) {
  const map = {
    racebox: "overview",
    bushnell: "baseball",
    tag: "baseball",
    garmin_r10: "golf",
    blue_tees: "golf",
    rapsodo_mlm: "golf",
    rapsodo: "brand-lines",
    garmin_xero: "shooting",
    rangecraft: "shooting",
  };
  return map[reportId] || "all";
}

function getViewConfig() {
  return {
    overview: {
      id: "overview",
      title: "亚马逊设备总览看板",
      label: "Amazon overview",
      description: "汇总入口，适合先看全部产品和更新时间。",
    },
    golf: {
      id: "golf",
      title: "高尔夫设备销量看板",
      label: "Golf devices",
      description: "查看高尔夫类设备的销量、销售额、价格变化。",
    },
    baseball: {
      id: "baseball",
      title: "棒球设备销量看板",
      label: "Baseball devices",
      description: "查看棒球测速与训练设备的月度表现。",
    },
    shooting: {
      id: "shooting",
      title: "射击设备销量看板",
      label: "Shooting devices",
      description: "查看弹道测速设备的销量和代际变化。",
    },
    "brand-lines": {
      id: "brand-lines",
      title: "品牌产品线对比看板",
      label: "Brand lines",
      description: "适合看双产品线、组合品牌和聚合销量。",
    },
    all: {
      id: "all",
      title: "全部产品明细看板",
      label: "All products",
      description: "查看所有报告的单品或品牌详情。",
    },
  };
}

function buildRefreshStatus(reports, heroRows, seriesRows, statusFile) {
  const timestamp = statusFile?.lastUpdated || "2026/04/23 16:42";
  return {
    lastUpdated: timestamp,
    note: statusFile?.note || "当前为历史竞品数据整理版，SellerSprite 每日自动更新将在下一步接入。",
    logs: statusFile?.logs || [
      { time: timestamp, tag: "Amazon", description: "竞品历史数据已整理进新入口页和详情页。"},
      { time: timestamp, tag: "UI", description: "已切换为可点击多页面结构，所有关键数值直接展示。"},
      { time: timestamp, tag: "Next", description: "下一步接入 SellerSprite 每日销量同步与自动刷新。"},
    ],
    trackedReportCount: reports.length,
    trackedSeriesCount: seriesRows.length,
    heroCount: heroRows.length,
  };
}

async function loadDashboardData() {
  const [reportsCsv, heroCsv, seriesCsv, insightsCsv, statusFile] = await Promise.all([
    fetch("./data/reports.csv").then((response) => response.text()),
    fetch("./data/hero_stats.csv").then((response) => response.text()),
    fetch("./data/monthly_series.csv").then((response) => response.text()),
    fetch("./data/insights.csv").then((response) => response.text()),
    fetch("./data/refresh_status.json").then((response) => response.json()),
  ]);

  const reportsRaw = csvToObjects(reportsCsv);
  const heroRaw = csvToObjects(heroCsv);
  const seriesRaw = csvToObjects(seriesCsv);
  const insightsRaw = csvToObjects(insightsCsv);

  const heroByReport = {};
  const seriesByReport = {};
  const insightsByReport = {};

  heroRaw.forEach((row) => {
    const item = {
      report_id: row.report_id,
      position: maybeNumber(row.position),
      label: row.label,
      value_text: row.value_text,
      value_numeric: maybeNumber(row.value_numeric),
    };
    heroByReport[item.report_id] ||= [];
    heroByReport[item.report_id].push(item);
  });

  seriesRaw.forEach((row) => {
    const item = {
      report_id: row.report_id,
      period_label: row.period_label,
      series_name: row.series_name,
      metric_kind: row.metric_kind,
      value: maybeNumber(row.value),
    };
    seriesByReport[item.report_id] ||= [];
    seriesByReport[item.report_id].push(item);
  });

  insightsRaw.forEach((row) => {
    const item = {
      report_id: row.report_id,
      position: maybeNumber(row.position),
      title: row.title,
      body: row.body,
    };
    insightsByReport[item.report_id] ||= [];
    insightsByReport[item.report_id].push(item);
  });

  const reports = reportsRaw.map((row) => {
    const report = {
      ...row,
      asin_count: maybeNumber(row.asin_count),
      hero_stats: heroByReport[row.report_id] || [],
      series: seriesByReport[row.report_id] || [],
      insights: insightsByReport[row.report_id] || [],
      category: classifyReport(row.report_id),
    };
    report.headline_sales =
      report.hero_stats.find((item) => item.value_numeric != null && item.label.includes("销量"))?.value_numeric ?? null;
    report.headline_revenue =
      report.hero_stats.find((item) => item.value_numeric != null && item.label.includes("销售额"))?.value_numeric ?? null;
    return report;
  });

  return {
    reports,
    refreshStatus: buildRefreshStatus(reports, heroRaw, seriesRaw, statusFile),
    viewConfig: getViewConfig(),
  };
}
