let salesChart;
let secondaryChart;
let dailyChart;

function getTodayCountryRows(report) {
  const rows = report.seller_sprite_daily || [];
  const latest = rows[rows.length - 1];
  if (!latest) return [];

  if (latest.countries && Object.keys(latest.countries).length) {
    return Object.entries(latest.countries)
      .map(([marketplace, item]) => ({
        marketplace,
        sales: item.sales || 0,
        amount: item.amount || 0,
        price: item.price || 0,
        bsr: item.bsr,
      }))
      .sort((a, b) => b.sales - a.sales);
  }

  const items = report.seller_sprite?.items || [];
  if (items.length === 1) {
    return [{
      marketplace: items[0].marketplace || "-",
      sales: latest.sales || 0,
      amount: latest.amount || 0,
      price: latest.price || 0,
      bsr: latest.bsr,
    }];
  }

  return items.map((item) => ({
    marketplace: item.marketplace || "-",
    sales: 0,
    amount: 0,
    price: 0,
    bsr: null,
  }));
}

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
          <img class="product-thumb" src="${report.image_url}" alt="${report.title}">
          <div class="product-chip-copy">
            <div class="product-name">${report.title}</div>
            <div class="product-asin">${report.primary_asin || report.brand}</div>
          </div>
        </button>
      `,
    )
    .join("");
}

function buildProductImage(report) {
  const hero = document.getElementById("product-hero-card");
  const panel = document.getElementById("product-image-panel");
  const imageMarkup = report.image_url
    ? `<img class="product-showcase-image" src="${report.image_url}" alt="${report.title}">`
    : `<div class="empty-state">当前产品还没有可展示的图片。</div>`;

  hero.innerHTML = `
    <div class="product-hero-copy">
      <p class="kicker">Product Spotlight</p>
      <h2>${report.title}</h2>
      <p class="product-hero-note">${report.card_description || report.subtitle || report.asin_text}</p>
      <div class="product-hero-meta">${report.primary_asin || report.brand} · ${report.brand_line || report.report_label || ""}</div>
    </div>
    <div class="product-hero-media">
      ${imageMarkup}
    </div>
  `;

  panel.innerHTML = `
    <div class="product-image-panel">
      ${imageMarkup}
      <div class="product-image-caption">${report.card_meta || report.product_tag || report.brand}</div>
    </div>
  `;
}

function buildSummary(report) {
  const syncState = report.seller_sprite?.status === "live" ? "已连通" : report.seller_sprite?.sync_label || "待接入";
  const syncNote = report.seller_sprite?.summary || "本页已经预留产品同步名单，下一步连每日更新。";
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
      value: syncState,
      note: syncNote,
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
  const items = report.seller_sprite?.items || [];
  if (items.length === 0) {
    document.getElementById("tracking-links").innerHTML = `
      <div class="tracking-item empty">
        <strong>还没有 SellerSprite 跟踪项</strong>
        <p>这份报告暂时没有绑定 ASIN 或市场，后续补齐后就能进入每天自动刷新。</p>
        <div class="tracking-tag pending">Pending setup</div>
      </div>
    `;
    return;
  }

  document.getElementById("tracking-links").innerHTML = items
    .map(
      (item) => `
        <div class="tracking-item">
          <strong>${item.label || item.asin || "待补充"}</strong>
          <p>${item.marketplace || "-"} · ${item.asin || "待补 ASIN"} · ${item.note || "已加入 SellerSprite 同步名单。"}</p>
          <div class="tracking-tag ${item.status || "configured"}">${item.status_text || item.status || "Configured"}</div>
        </div>
      `,
    )
    .join("");
}

function buildTodaySection(report) {
  const rows = report.seller_sprite_daily || [];
  if (rows.length === 0) {
    document.getElementById("today-global-strip").innerHTML = `
      <div class="empty-state">今天的全球销量会在 SellerSprite 首次返回逐日快照后显示到这里。</div>
    `;
    document.getElementById("today-country-grid").innerHTML = "";
    return;
  }

  const latest = rows[rows.length - 1];
  const countryRows = getTodayCountryRows(report);
  const activeCountries = countryRows.filter((item) => item.sales > 0).length;

  document.getElementById("today-global-strip").innerHTML = `
    <div class="daily-metric">
      <span>今日日期</span>
      <strong>${latest.date}</strong>
    </div>
    <div class="daily-metric">
      <span>今日全球销量</span>
      <strong>${latest.sales}</strong>
    </div>
    <div class="daily-metric">
      <span>今日全球销售额</span>
      <strong>$${formatCompact(latest.amount || 0)}</strong>
    </div>
    <div class="daily-metric">
      <span>今日覆盖国家</span>
      <strong>${activeCountries}</strong>
    </div>
  `;

  document.getElementById("today-country-grid").innerHTML = countryRows
    .map((item) => `
      <article class="today-country-card ${item.sales > 0 ? "active" : "inactive"}">
        <div class="today-country-head">
          <strong>${item.marketplace}</strong>
          <span>${item.sales > 0 ? "Live" : "No sale"}</span>
        </div>
        <div class="today-country-main">${item.sales}</div>
        <div class="today-country-sub">今日销量</div>
        <div class="today-country-note">$${formatCompact(item.amount || 0)} · ${item.price ? `$${item.price}` : "无价格"}</div>
      </article>
    `)
    .join("");
}

function buildDailyStrip(report) {
  const rows = report.seller_sprite_daily || [];
  if (rows.length === 0) {
    document.getElementById("daily-strip").innerHTML = `
      <div class="daily-metric empty-state">
        <strong>等待首次自动刷新</strong>
        <span>SellerSprite 每日销量数据会在自动任务首次跑完后显示到这里。</span>
      </div>
    `;
    return;
  }

  const latest = rows[rows.length - 1];
  const total = rows.reduce((sum, row) => sum + (row.sales || 0), 0);
  const revenue = rows.reduce((sum, row) => sum + (row.amount || 0), 0);
  const averagePrice = rows.reduce((sum, row) => sum + (row.price || 0), 0) / rows.length;

  document.getElementById("daily-strip").innerHTML = `
    <div class="daily-metric">
      <span>最近日期</span>
      <strong>${latest.date}</strong>
    </div>
    <div class="daily-metric">
      <span>14 日累计销量</span>
      <strong>${total}</strong>
    </div>
    <div class="daily-metric">
      <span>14 日累计销售额</span>
      <strong>$${formatCompact(revenue)}</strong>
    </div>
    <div class="daily-metric">
      <span>14 日均价</span>
      <strong>$${Math.round(averagePrice)}</strong>
    </div>
  `;
}

function buildDailyTable(report) {
  const rows = report.seller_sprite_daily || [];
  if (rows.length === 0) {
    document.getElementById("daily-table").innerHTML = `
      <div class="empty-state">
        SellerSprite 日销量明细会在首次自动刷新后出现在这里。
      </div>
    `;
    return;
  }

  const body = [...rows]
    .reverse()
    .map(
      (row) => `
        <tr>
          <td>${row.date}</td>
          <td>${row.sales}</td>
          <td>$${row.amount.toLocaleString()}</td>
          <td>$${row.price}</td>
          <td>${row.bsr.toLocaleString()}</td>
        </tr>
      `,
    )
    .join("");

  document.getElementById("daily-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>销量</th>
          <th>销售额</th>
          <th>价格</th>
          <th>BSR</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
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

  const dailyRows = report.seller_sprite_daily || [];
  if (dailyChart) dailyChart.destroy();
  const dailyCanvas = document.getElementById("daily-chart");

  if (dailyRows.length === 0) {
    const ctx = dailyCanvas.getContext("2d");
    ctx.clearRect(0, 0, dailyCanvas.width, dailyCanvas.height);
    return;
  }

  dailyChart = new Chart(dailyCanvas, {
    data: {
      labels: dailyRows.map((row) => row.date.slice(5)),
      datasets: [
        {
          type: "bar",
          label: "日销量",
          data: dailyRows.map((row) => row.sales),
          backgroundColor: report.theme_color || "#5d84f1",
          borderRadius: 8,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "价格",
          data: dailyRows.map((row) => row.price),
          borderColor: "#b38322",
          backgroundColor: "rgba(179,131,34,0.16)",
          yAxisID: "y1",
          tension: 0.25,
        },
      ],
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
  buildTodaySection(report);
  buildProductImage(report);
  buildHeroStats(report);
  buildInsights(report);
  buildTrackingLinks(report);
  buildDailyStrip(report);
  buildDailyTable(report);
  buildMonthlyTable(report);
  renderCharts(report);

  document.getElementById("product-chooser").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-report-id]");
    if (!chip) return;
    const next = filtered.find((item) => item.report_id === chip.dataset.reportId);
    if (!next) return;
    buildChooser(filtered, next.report_id);
    buildSummary(next);
    buildTodaySection(next);
    buildProductImage(next);
    buildHeroStats(next);
    buildInsights(next);
    buildTrackingLinks(next);
    buildDailyStrip(next);
    buildDailyTable(next);
    buildMonthlyTable(next);
    renderCharts(next);
  });
}

loadDashboardData().then(renderReportView);
