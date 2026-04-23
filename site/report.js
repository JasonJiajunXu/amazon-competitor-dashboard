let salesChart;
let secondaryChart;

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function readViewId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("view") || "overview";
}

function createValueLabelPlugin() {
  return {
    id: "value-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "600 11px Manrope";
      ctx.fillStyle = "#576070";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value == null) return;
          const position = element.tooltipPosition();
          ctx.textAlign = "center";
          ctx.fillText(String(value), position.x, position.y - 8);
        });
      });
      ctx.restore();
    },
  };
}

function buildChooser(reports, activeReportId) {
  const chooser = document.getElementById("product-chooser");
  chooser.innerHTML = reports
    .map(
      (report) => `
        <button class="product-chip ${report.report_id === activeReportId ? "active" : ""}" data-report-id="${report.report_id}">
          <div class="product-name">${report.title}</div>
          <div class="product-asin">${report.primary_asin || report.brand}</div>
        </button>
      `,
    )
    .join("");
}

function buildSummary(report) {
  const cards = [
    {
      label: "主销量指标",
      value: formatCompact(report.headline_sales),
      note: report.headline_metric_1_label || "销量",
    },
    {
      label: "主销售额指标",
      value: report.headline_revenue ? `$${formatCompact(report.headline_revenue)}` : "-",
      note: report.headline_metric_2_label || "销售额",
    },
    {
      label: "ASIN",
      value: report.primary_asin || "聚合看板",
      note: report.asin_text,
    },
    {
      label: "SellerSprite 状态",
      value: "待接入",
      note: "本页已经预留产品同步名单，下一步连每日更新。",
    },
  ];

  document.getElementById("summary-strip").innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <div class="kicker">${card.label}</div>
          <div class="summary-value">${card.value}</div>
          <div class="summary-note">${card.note}</div>
        </article>
      `,
    )
    .join("");
}

function buildHeroStats(report) {
  document.getElementById("hero-stats").innerHTML = report.hero_stats
    .map(
      (item) => `
        <div class="stat-line">
          <span>${item.label}</span>
          <strong>${item.value_text}</strong>
        </div>
      `,
    )
    .join("");
}

function buildInsights(report) {
  document.getElementById("insights").innerHTML = report.insights
    .slice(0, 5)
    .map(
      (item) => `
        <div class="insight-item">
          <strong>${item.title}</strong>
          <p>${item.body}</p>
        </div>
      `,
    )
    .join("");
}

function buildTrackingLinks(report) {
  const asins = [...new Set((report.asin_text.match(/\b[A-Z0-9]{10}\b/g) || []))];
  const items = asins.length > 0 ? asins : [report.primary_asin].filter(Boolean);
  document.getElementById("tracking-links").innerHTML = items
    .map(
      (asin) => `
        <div class="tracking-item">
          <strong>${asin}</strong>
          <p>${report.title} 已纳入 SellerSprite 同步名单。下一步会把这些 ASIN 接到每日自动刷新脚本。</p>
          <div class="tracking-tag">Ready for daily sync</div>
        </div>
      `,
    )
    .join("");
}

function buildMonthlyTable(report) {
  const groups = {};
  report.series.forEach((row) => {
    groups[row.series_name] ||= [];
    groups[row.series_name].push(row);
  });
  const labels = Object.values(groups)[0]?.map((item) => item.period_label) || [];

  const header = labels.map((label) => `<th>${label}</th>`).join("");
  const body = Object.entries(groups)
    .map(([seriesName, rows]) => {
      const cells = rows.map((row) => `<td>${row.value}</td>`).join("");
      return `<tr><td>${seriesName}</td>${cells}</tr>`;
    })
    .join("");

  document.getElementById("monthly-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>序列</th>
          ${header}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function splitSeries(report) {
  const groups = {};
  report.series.forEach((row) => {
    groups[row.series_name] ||= [];
    groups[row.series_name].push(row);
  });
  return groups;
}

function renderCharts(report) {
  const groups = splitSeries(report);
  const labels = Object.values(groups)[0]?.map((item) => item.period_label) || [];
  const salesEntries = Object.entries(groups).filter(([, rows]) => rows[0]?.metric_kind === "units" || rows[0]?.metric_kind === "segment_units");
  const secondaryEntries = Object.entries(groups).filter(([, rows]) => rows[0]?.metric_kind === "revenue" || rows[0]?.metric_kind === "price");

  if (salesChart) salesChart.destroy();
  salesChart = new Chart(document.getElementById("sales-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: salesEntries.map(([seriesName, rows], index) => ({
        label: seriesName,
        data: rows.map((row) => row.value),
        backgroundColor: index === 0 ? (report.theme_color || "#5d84f1") : `rgba(93,132,241,${0.28 + index * 0.18})`,
        borderRadius: 8,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true } },
        tooltip: { enabled: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    },
    plugins: [createValueLabelPlugin()],
  });

  if (secondaryChart) secondaryChart.destroy();
  secondaryChart = new Chart(document.getElementById("secondary-chart"), {
    data: {
      labels,
      datasets: secondaryEntries.map(([seriesName, rows]) => {
        const isPrice = rows[0]?.metric_kind === "price";
        return {
          label: seriesName,
          data: rows.map((row) => row.value),
          type: isPrice ? "line" : "bar",
          borderColor: isPrice ? "#b38322" : (report.theme_color || "#5d84f1"),
          backgroundColor: isPrice ? "rgba(179,131,34,0.18)" : "rgba(93,132,241,0.2)",
          borderRadius: 8,
          yAxisID: isPrice ? "y1" : "y",
          tension: 0.25,
        };
      }),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true } },
        tooltip: { enabled: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          beginAtZero: false,
        },
      },
    },
    plugins: [createValueLabelPlugin()],
  });
}

function renderReportView(payload) {
  const viewId = readViewId();
  const config = payload.viewConfig[viewId] || payload.viewConfig.overview;
  const filtered = viewId === "overview" || viewId === "all"
    ? payload.reports
    : payload.reports.filter((report) => report.category === viewId);

  const report = filtered[0] || payload.reports[0];
  document.getElementById("view-title").textContent = config.title;
  document.getElementById("view-label").textContent = config.label;
  document.getElementById("report-last-updated").textContent = payload.refreshStatus.lastUpdated;

  buildChooser(filtered, report.report_id);
  buildSummary(report);
  buildHeroStats(report);
  buildInsights(report);
  buildTrackingLinks(report);
  buildMonthlyTable(report);
  renderCharts(report);

  document.getElementById("product-chooser").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-report-id]");
    if (!chip) return;
    const next = filtered.find((item) => item.report_id === chip.dataset.reportId);
    if (!next) return;
    buildChooser(filtered, next.report_id);
    buildSummary(next);
    buildHeroStats(next);
    buildInsights(next);
    buildTrackingLinks(next);
    buildMonthlyTable(next);
    renderCharts(next);
  });
}

loadDashboardData().then(renderReportView);
