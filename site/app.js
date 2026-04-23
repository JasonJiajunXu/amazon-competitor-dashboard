let salesChart;
let revenueChart;
let detailChart;

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
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
  const labels =
    Object.values(grouped)[0]?.map((row) => row.period_label) || [];

  const datasets = Object.entries(grouped)
    .filter(([seriesName]) => seriesName !== "M")
    .map(([seriesName, rows]) => {
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
  const dataUrl = window.location.pathname.includes("/site/")
    ? "../data/dashboard.json"
    : "./data/dashboard.json";
  const response = await fetch(dataUrl);
  const payload = await response.json();
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
