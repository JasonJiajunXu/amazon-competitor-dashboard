let salesChart;
let revenueChart;
let detailChart;

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

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

function hydratePayload([reportsRaw, heroRaw, seriesRaw, insightsRaw]) {
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

  const reports = reportsRaw.map((row) => ({
    ...row,
    asin_count: maybeNumber(row.asin_count),
    hero_stats: heroByReport[row.report_id] || [],
    series: seriesByReport[row.report_id] || [],
    insights: insightsByReport[row.report_id] || [],
  }));

  reports.forEach((report) => {
    report.headline_sales =
      report.hero_stats.find((item) => item.value_numeric != null && item.label.includes("销量"))?.value_numeric ?? null;
    report.headline_revenue =
      report.hero_stats.find((item) => item.value_numeric != null && item.label.includes("销售额"))?.value_numeric ?? null;
  });

  return {
    report_count: reports.length,
    series_count: seriesRaw.length,
    reports,
  };
}

function buildSummaryCards(reports) {
  const container = document.getElementById("summary-cards");
  container.innerHTML = reports
    .map(
      (report) => `
        <article class="summary-card">
          <div class="brand">${report.brand}</div>
          <div class="title">${report.title}</div>
          <div class="metrics">
            <div class="metric">
              <div class="label">Headline Sales</div>
              <div class="value">${formatCompact(report.headline_sales)}</div>
            </div>
            <div class="metric">
              <div class="label">Headline Revenue</div>
              <div class="value">${report.headline_revenue ? "$" + formatCompact(report.headline_revenue) : "-"}</div>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function buildOverviewCharts(reports) {
  const labels = reports.map((report) => report.title);
  const colors = reports.map((report) => report.theme_color || "#0f766e");

  salesChart = new Chart(document.getElementById("sales-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Headline Sales",
          data: reports.map((report) => report.headline_sales ?? 0),
          backgroundColor: colors,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    },
  });

  revenueChart = new Chart(document.getElementById("revenue-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Headline Revenue",
          data: reports.map((report) => report.headline_revenue ?? 0),
          backgroundColor: colors,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return `$${formatCompact(value)}`;
            },
          },
        },
      },
    },
  });
}

function seriesGroups(report) {
  const grouped = {};
  for (const row of report.series) {
    grouped[row.series_name] ||= [];
    grouped[row.series_name].push(row);
  }
  return grouped;
}

function renderReportDetail(report) {
  const header = document.getElementById("report-header");
  header.innerHTML = `
    <img src="${report.image_url}" alt="${report.title}">
    <div>
      <div class="report-title">${report.title}</div>
      <div class="report-subtitle">${report.subtitle}</div>
      <div class="report-meta">${report.asin_text}</div>
      <div class="report-meta">${report.product_tag}</div>
    </div>
  `;

  const heroStats = document.getElementById("hero-stats");
  heroStats.className = "stats-list";
  heroStats.innerHTML = report.hero_stats
    .map(
      (row) => `
        <div class="stats-row">
          <span>${row.label}</span>
          <span class="value">${row.value_text}</span>
        </div>
      `,
    )
    .join("");

  const insights = document.getElementById("insights");
  insights.innerHTML =
    report.insights.length > 0
      ? report.insights
          .slice(0, 4)
          .map(
            (item) => `
              <div class="insight-item">
                <strong>${item.title}</strong><br>
                ${item.body}
              </div>
            `,
          )
          .join("")
      : `<div class="insight-item">这份报告原始页面没有单独写 insight 卡，但月度序列已经保留下来了。</div>`;

  const grouped = seriesGroups(report);
  const labels = Object.values(grouped)[0]?.map((row) => row.period_label) || [];

  const datasets = Object.entries(grouped).map(([seriesName, rows]) => {
    const lower = seriesName.toLowerCase();
    const isRevenue = lower.includes("rev");
    const isPrice = lower.includes("price");
    return {
      label: seriesName,
      data: rows.map((row) => row.value),
      borderColor: report.theme_color,
      backgroundColor: isRevenue
        ? `${report.theme_color}22`
        : isPrice
          ? "#d9770622"
          : `${report.theme_color}55`,
      type: isRevenue || isPrice ? "line" : "bar",
      yAxisID: isPrice ? "y1" : "y",
      tension: 0.28,
      borderWidth: 2,
      borderRadius: 6,
    };
  });

  if (detailChart) detailChart.destroy();
  detailChart = new Chart(document.getElementById("detail-chart"), {
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
        y1: {
          position: "right",
          beginAtZero: false,
          grid: { drawOnChartArea: false },
          ticks: {
            callback(value) {
              return `$${value}`;
            },
          },
        },
      },
    },
  });
}

async function init() {
  const [reportsCsv, heroCsv, seriesCsv, insightsCsv] = await Promise.all([
    fetch("./data/reports.csv").then((response) => response.text()),
    fetch("./data/hero_stats.csv").then((response) => response.text()),
    fetch("./data/monthly_series.csv").then((response) => response.text()),
    fetch("./data/insights.csv").then((response) => response.text()),
  ]);

  const payload = hydratePayload([
    csvToObjects(reportsCsv),
    csvToObjects(heroCsv),
    csvToObjects(seriesCsv),
    csvToObjects(insightsCsv),
  ]);

  document.getElementById("report-count").textContent = payload.report_count;
  document.getElementById("series-count").textContent = payload.series_count;

  buildSummaryCards(payload.reports);
  buildOverviewCharts(payload.reports);

  const select = document.getElementById("report-select");
  payload.reports.forEach((report) => {
    const option = document.createElement("option");
    option.value = report.report_id;
    option.textContent = `${report.brand} · ${report.title}`;
    select.appendChild(option);
  });

  const update = () => {
    const report = payload.reports.find((item) => item.report_id === select.value) || payload.reports[0];
    renderReportDetail(report);
  };

  select.addEventListener("change", update);
  select.value = payload.reports[0].report_id;
  update();
}

init();
