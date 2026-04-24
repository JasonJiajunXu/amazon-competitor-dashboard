let dragyRecentChart;
let dragyMonthlyChart;
let dragyMonthDailyChart;

const DRAGY_COLORS = {
  global: "#111827",
  dragy_pro: "#e63946",
  dragy: "#5d84f1",
  US: "#e63946",
  UK: "#5d84f1",
  DE: "#2f8f83",
  FR: "#b38322",
  IT: "#7b61ff",
  ES: "#f08a24",
  CA: "#4f6d7a",
  JP: "#22223b",
  AU: "#0f9d58",
};

const state = {
  payload: null,
  scopeId: "global",
  month: null,
};

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${Math.round(value).toLocaleString()}`;
}

function loadDragyData() {
  if (window.__DRAGY_DASHBOARD_DATA__) {
    return Promise.resolve(window.__DRAGY_DASHBOARD_DATA__);
  }
  return fetch("./data/dragy_dashboard.json").then((response) => response.json());
}

function getScope() {
  return state.payload.scopes[state.scopeId];
}

function getSelectedMonthData() {
  const scope = getScope();
  return scope.monthDrilldowns[state.month];
}

function ensureSelectedMonth() {
  const scope = getScope();
  if (!state.month || !scope.monthDrilldowns[state.month]) {
    const fallback = scope.monthlySeries[scope.monthlySeries.length - 1];
    state.month = fallback ? fallback.month : state.payload.defaultMonth;
  }
}

function renderHero() {
  const payload = state.payload;
  document.getElementById("dragy-last-updated").textContent = payload.generatedAt;
  document.getElementById("dragy-hero-card").innerHTML = `
    <div class="product-hero-copy">
      <p class="kicker">Brand Overview</p>
      <h2>${payload.title}</h2>
      <p class="product-hero-note">这页先让用户直接看到最近 30 天每天销量，再往下钻到 dragy Pro 和 dragy 两条产品线，最后再去看国家地图和月份明细。</p>
      <div class="product-hero-meta">${payload.recent30Start} 至 ${payload.recent30End} · 近 12 个月可钻取 · 国家和月份联动展示</div>
    </div>
    <div class="product-hero-media">
      <img class="product-showcase-image" src="${payload.heroImage}" alt="dragy 主图">
    </div>
  `;
}

function renderScopeTabs() {
  const scope = getScope();
  const tabs = state.payload.scopeOrder
    .map((scopeId) => {
      const item = state.payload.scopes[scopeId];
      const active = scopeId === state.scopeId ? "active" : "";
      return `
        <button class="product-chip ${active}" type="button" data-scope="${scopeId}">
          <div class="product-chip-copy">
            <div class="product-name">${item.meta.name}</div>
            <div class="product-asin">${item.meta.label} · 30天销量 ${item.recent30.sales}</div>
          </div>
        </button>
      `;
    })
    .join("");
  document.getElementById("dragy-scope-tabs").innerHTML = tabs;
  document.querySelectorAll("[data-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scopeId = button.dataset.scope;
      ensureSelectedMonth();
      renderDynamic();
    });
  });

  return scope;
}

function renderSummary() {
  const scope = getScope();
  const recent = scope.recent30;
  const latestMonth = scope.monthlySeries[scope.monthlySeries.length - 1];
  const topCountry = [...recent.countrySummary].sort((a, b) => b.sales - a.sales)[0];

  document.getElementById("dragy-summary").innerHTML = `
    <article class="summary-card">
      <div class="kicker">Selected Scope</div>
      <div class="summary-value">${scope.meta.name}</div>
      <div class="summary-note">${scope.meta.description}</div>
    </article>
    <article class="summary-card">
      <div class="kicker">30D Sales</div>
      <div class="summary-value">${recent.sales}</div>
      <div class="summary-note">最近 30 天总销量</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Latest Month</div>
      <div class="summary-value">${latestMonth ? latestMonth.sales : 0}</div>
      <div class="summary-note">${latestMonth ? latestMonth.label : "-"} 月销量</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Lead Country</div>
      <div class="summary-value">${topCountry ? topCountry.country : "-"}</div>
      <div class="summary-note">${topCountry ? `${topCountry.sales} 件 / 30天` : "暂无国家销量"}</div>
    </article>
  `;
}

function renderLineCards() {
  const cards = ["dragy_pro", "dragy"]
    .map((scopeId) => {
      const scope = state.payload.scopes[scopeId];
      const recent = scope.recent30;
      const topCountry = [...recent.countrySummary].sort((a, b) => b.sales - a.sales)[0];
      const active = scopeId === state.scopeId ? "active" : "";
      const markets = recent.countrySummary
        .filter((item) => item.sales > 0)
        .map((item) => item.marketplace)
        .join(" · ");
      return `
        <article class="detail-card line-card ${active}" data-scope-card="${scopeId}">
          <div class="panel-heading compact">
            <p class="kicker">${scope.meta.label}</p>
            <h3>${scope.meta.name}</h3>
          </div>
          <p class="summary-note">${scope.meta.description}</p>
          <div class="line-card-grid">
            <div class="line-card-stat">
              <span>30天销量</span>
              <strong>${recent.sales}</strong>
            </div>
            <div class="line-card-stat">
              <span>活跃国家</span>
              <strong>${scope.activeCountryCount}</strong>
            </div>
            <div class="line-card-stat">
              <span>主力国家</span>
              <strong>${topCountry ? topCountry.country : "-"}</strong>
            </div>
            <div class="line-card-stat">
              <span>均价</span>
              <strong>${formatCurrency(recent.avgPrice)}</strong>
            </div>
          </div>
          <div class="line-card-markets">${markets || "当前没有抓到有效国家销量"}</div>
        </article>
      `;
    })
    .join("");
  document.getElementById("dragy-line-cards").innerHTML = cards;
  document.querySelectorAll("[data-scope-card]").forEach((card) => {
    card.addEventListener("click", () => {
      state.scopeId = card.dataset.scopeCard;
      ensureSelectedMonth();
      renderDynamic();
    });
  });
}

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function createMonthValuePlugin() {
  return {
    id: "month-values",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "700 11px Manrope";
      ctx.fillStyle = "#576070";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (value == null || value === 0) return;
          const point = element.tooltipPosition();
          ctx.textAlign = "center";
          ctx.fillText(String(value), point.x, point.y - 8);
        });
      });
      ctx.restore();
    },
  };
}

function renderRecentSection() {
  const scope = getScope();
  const rows = scope.recent30.dailyRows;
  const latest = rows[rows.length - 1];
  const peak = [...rows].sort((a, b) => b.sales - a.sales)[0];
  const avgDaily = rows.length ? Math.round(scope.recent30.sales / rows.length) : 0;
  const markets = scope.recent30.countrySummary.filter((item) => item.sales > 0).map((item) => item.marketplace);

  document.getElementById("dragy-recent-metrics").innerHTML = `
    <div class="daily-metric">
      <span>最近日期</span>
      <strong>${state.payload.recent30End}</strong>
    </div>
    <div class="daily-metric">
      <span>最近单日销量</span>
      <strong>${latest ? latest.sales : "-"}</strong>
    </div>
    <div class="daily-metric">
      <span>30天日均</span>
      <strong>${avgDaily}</strong>
    </div>
    <div class="daily-metric">
      <span>峰值单日</span>
      <strong>${peak ? `${peak.date.slice(5)} · ${peak.sales}` : "-"}</strong>
    </div>
  `;

  destroyChart(dragyRecentChart);
  const isGlobal = state.scopeId === "global";
  dragyRecentChart = new Chart(document.getElementById("dragy-recent-chart"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.date.slice(5)),
      datasets: isGlobal
        ? [
            {
              label: "dragy Pro",
              data: rows.map((row) => row.lines.dragy_pro),
              backgroundColor: DRAGY_COLORS.dragy_pro,
              borderRadius: 6,
              stack: "sales",
            },
            {
              label: "dragy",
              data: rows.map((row) => row.lines.dragy),
              backgroundColor: DRAGY_COLORS.dragy,
              borderRadius: 6,
              stack: "sales",
            },
          ]
        : [
            {
              label: scope.meta.name,
              data: rows.map((row) => row.sales),
              backgroundColor: DRAGY_COLORS[state.scopeId],
              borderRadius: 6,
            },
          ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true } },
        tooltip: { enabled: true },
      },
      scales: {
        x: { stacked: isGlobal, grid: { display: false } },
        y: { beginAtZero: true, stacked: isGlobal },
      },
    },
  });

  document.getElementById("dragy-recent-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>总销量</th>
          ${isGlobal ? "<th>dragy Pro</th><th>dragy</th>" : ""}
          ${markets.map((market) => `<th>${market}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${[...rows].reverse().map((row) => `
          <tr>
            <td>${row.date}</td>
            <td>${row.sales}</td>
            ${isGlobal ? `<td>${row.lines.dragy_pro}</td><td>${row.lines.dragy}</td>` : ""}
            ${markets.map((market) => `<td>${row.countries[market].sales}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderMonthSection() {
  const scope = getScope();
  const months = scope.monthlySeries;
  const monthData = getSelectedMonthData();
  const rows = monthData.dailyRows;
  const peak = [...rows].sort((a, b) => b.sales - a.sales)[0];
  const activeCountries = monthData.countrySummary.filter((item) => item.sales > 0).length;
  const avgDaily = rows.length ? Math.round(monthData.sales / rows.length) : 0;
  const markets = monthData.countrySummary.filter((item) => item.sales > 0).map((item) => item.marketplace);
  const isGlobal = state.scopeId === "global";

  destroyChart(dragyMonthlyChart);
  dragyMonthlyChart = new Chart(document.getElementById("dragy-monthly-chart"), {
    type: "bar",
    data: {
      labels: months.map((item) => item.label.slice(2)),
      datasets: [
        {
          label: scope.meta.name,
          data: months.map((item) => item.sales),
          backgroundColor: DRAGY_COLORS[state.scopeId],
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    },
    plugins: [createMonthValuePlugin()],
  });

  document.getElementById("dragy-month-chips").innerHTML = months
    .map(
      (item) => `
        <button type="button" class="month-chip ${item.month === state.month ? "active" : ""}" data-month="${item.month}">
          <span>${item.label}</span>
          <strong>${item.sales}</strong>
        </button>
      `,
    )
    .join("");
  document.querySelectorAll("[data-month]").forEach((button) => {
    button.addEventListener("click", () => {
      state.month = button.dataset.month;
      renderDynamic();
    });
  });

  document.getElementById("dragy-month-metrics").innerHTML = `
    <div class="daily-metric">
      <span>当前月份</span>
      <strong>${monthData.label}</strong>
    </div>
    <div class="daily-metric">
      <span>月销量</span>
      <strong>${monthData.sales}</strong>
    </div>
    <div class="daily-metric">
      <span>日均销量</span>
      <strong>${avgDaily}</strong>
    </div>
    <div class="daily-metric">
      <span>峰值日</span>
      <strong>${peak ? `${peak.date.slice(5)} · ${peak.sales}` : "-"}</strong>
    </div>
  `;

  destroyChart(dragyMonthDailyChart);
  dragyMonthDailyChart = new Chart(document.getElementById("dragy-month-daily-chart"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.date.slice(8)),
      datasets: isGlobal
        ? [
            {
              label: "dragy Pro",
              data: rows.map((row) => row.lines.dragy_pro),
              backgroundColor: DRAGY_COLORS.dragy_pro,
              stack: "month-sales",
              borderRadius: 6,
            },
            {
              label: "dragy",
              data: rows.map((row) => row.lines.dragy),
              backgroundColor: DRAGY_COLORS.dragy,
              stack: "month-sales",
              borderRadius: 6,
            },
          ]
        : [
            {
              label: scope.meta.name,
              data: rows.map((row) => row.sales),
              backgroundColor: DRAGY_COLORS[state.scopeId],
              borderRadius: 6,
            },
          ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top", labels: { usePointStyle: true } },
        tooltip: { enabled: true },
      },
      scales: {
        x: { stacked: isGlobal, grid: { display: false } },
        y: { beginAtZero: true, stacked: isGlobal },
      },
    },
  });

  document.getElementById("dragy-month-daily-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>总销量</th>
          ${isGlobal ? "<th>dragy Pro</th><th>dragy</th>" : ""}
          ${markets.map((market) => `<th>${market}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${[...rows].reverse().map((row) => `
          <tr>
            <td>${row.date}</td>
            <td>${row.sales}</td>
            ${isGlobal ? `<td>${row.lines.dragy_pro}</td><td>${row.lines.dragy}</td>` : ""}
            ${markets.map((market) => `<td>${row.countries[market].sales}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="month-footnote">当前选中 ${monthData.label}，有销量国家 ${activeCountries} 个。</div>
  `;
}

function renderMapSection() {
  const scope = getScope();
  const monthData = getSelectedMonthData();
  const maxSales = Math.max(...monthData.countrySummary.map((item) => item.sales), 1);
  const mapSvg = `
    <svg viewBox="0 0 1000 520" class="atlas-svg" aria-hidden="true">
      <ellipse cx="165" cy="155" rx="120" ry="76" class="atlas-land"></ellipse>
      <ellipse cx="265" cy="330" rx="64" ry="105" class="atlas-land"></ellipse>
      <ellipse cx="500" cy="150" rx="90" ry="56" class="atlas-land"></ellipse>
      <ellipse cx="575" cy="120" rx="48" ry="36" class="atlas-land"></ellipse>
      <ellipse cx="560" cy="258" rx="94" ry="124" class="atlas-land"></ellipse>
      <ellipse cx="770" cy="190" rx="176" ry="98" class="atlas-land"></ellipse>
      <ellipse cx="848" cy="378" rx="96" ry="60" class="atlas-land"></ellipse>
    </svg>
  `;

  const markers = monthData.countrySummary
    .map((item) => {
      const point = state.payload.mapPositions[item.marketplace];
      const size = item.sales > 0 ? 26 + Math.round((item.sales / maxSales) * 30) : 14;
      return `
        <div class="map-marker ${item.sales > 0 ? "active" : "inactive"}"
             style="left:${point.x}%;top:${point.y}%;width:${size}px;height:${size}px;border-color:${DRAGY_COLORS[item.marketplace]};">
          <span class="map-marker-dot" style="background:${DRAGY_COLORS[item.marketplace]};"></span>
          <div class="map-marker-label">
            <strong>${item.marketplace}</strong>
            <span>${item.sales}</span>
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById("dragy-map-board").innerHTML = `
    <div class="atlas-surface">
      ${mapSvg}
      ${markers}
    </div>
    <div class="map-caption">当前地图展示的是 ${scope.meta.name} 在 ${monthData.label} 的国家销量分布。</div>
  `;

  const recentSummary = scope.recent30.countrySummary.reduce((acc, item) => {
    acc[item.marketplace] = item;
    return acc;
  }, {});

  document.getElementById("dragy-country-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>国家</th>
          <th>站点</th>
          <th>${monthData.label}</th>
          <th>最近30天</th>
          <th>30天均价</th>
          <th>产品数</th>
        </tr>
      </thead>
      <tbody>
        ${monthData.countrySummary.map((item) => `
          <tr>
            <td>${item.country}</td>
            <td>${item.marketplace}</td>
            <td>${item.sales}</td>
            <td>${recentSummary[item.marketplace]?.sales ?? 0}</td>
            <td>${formatCurrency(recentSummary[item.marketplace]?.avgPrice ?? 0)}</td>
            <td>${item.productCount}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderSidebar() {
  const scope = getScope();
  document.getElementById("dragy-image-panel").innerHTML = `
    <div class="product-image-panel">
      <img class="product-showcase-image" src="${scope.heroImage || state.payload.heroImage}" alt="${scope.meta.name} 产品图">
      <div class="product-image-caption">${scope.meta.name} 当前使用销量最高的产品图作为视觉封面。</div>
    </div>
  `;

  document.getElementById("dragy-product-list").innerHTML = scope.products
    .map(
      (item) => `
        <div class="tracking-item">
          <strong>${item.country} · ${item.asin}</strong>
          <p>${item.title}</p>
          <div class="tracking-tag live">30天 ${item.recent30Sales} · 本月 ${item.currentMonthSales} · ${formatCurrency(item.price)}</div>
        </div>
      `,
    )
    .join("");

  document.getElementById("dragy-notes").innerHTML = state.payload.notes
    .map(
      (note) => `
        <div class="insight-item">
          <p>${note}</p>
        </div>
      `,
    )
    .join("");
}

function renderDynamic() {
  renderScopeTabs();
  renderSummary();
  renderLineCards();
  renderRecentSection();
  renderMonthSection();
  renderMapSection();
  renderSidebar();
}

loadDragyData().then((payload) => {
  state.payload = payload;
  state.month = payload.defaultMonth;
  renderHero();
  ensureSelectedMonth();
  renderDynamic();
});
