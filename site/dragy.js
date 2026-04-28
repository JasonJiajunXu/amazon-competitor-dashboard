let dragyRecentChart;
let dragyMonthlyChart;
let dragyMonthDailyChart;

const DRAGY_COLORS = {
  global: "#111827",
  dragy_pro: "#e63946",
  dragy: "#5d84f1",
  dragy_pro_refurbished: "#8f5cff",
  dragy_refurbished: "#6b7280",
  mount: "#b38322",
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

const WORLD_MAP_HTML = window.__WORLD_MAP_SVG__ || "";
const MARKET_TO_MAP_ID = {
  US: "us",
  CA: "ca",
  UK: "gb",
  DE: "de",
  FR: "fr",
  IT: "it",
  ES: "es",
  JP: "jp",
  AU: "au",
};
const MAP_LABEL_OFFSETS = {
  US: { x: -2.5, y: 7 },
  CA: { x: -3, y: -5 },
  UK: { x: -1.5, y: -5.5 },
  DE: { x: 3.2, y: -3.5 },
  FR: { x: -3.4, y: 2.8 },
  IT: { x: 4.2, y: 5.2 },
  ES: { x: -4.4, y: 5.6 },
  JP: { x: 4.4, y: -2.4 },
  AU: { x: 2.2, y: 7.2 },
};
const MAP_FILL_LOW = "#dbe8ef";
const MAP_FILL_HIGH = "#355f96";
const MAP_STROKE_LOW = "#aabcc6";
const MAP_STROKE_HIGH = "#183a62";

const state = {
  payload: null,
  scopeId: "global",
  month: null,
};

function getScopeName(scopeId) {
  if (scopeId === "global") return "全部产品";
  return state.payload.scopes[scopeId].meta.name;
}

function isPortfolioView() {
  return state.scopeId === "global";
}

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

function parseHexColor(hex) {
  const cleaned = hex.replace("#", "");
  const value = cleaned.length === 3
    ? cleaned.split("").map((char) => `${char}${char}`).join("")
    : cleaned;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function mixHexColors(start, end, t) {
  const from = parseHexColor(start);
  const to = parseHexColor(end);
  const clamp = Math.max(0, Math.min(1, t));
  const blend = (left, right) => Math.round(left + (right - left) * clamp);
  return `rgb(${blend(from.r, to.r)}, ${blend(from.g, to.g)}, ${blend(from.b, to.b)})`;
}

function buildMapLegend(maxSales) {
  if (!maxSales) {
    return `
      <div class="map-legend">
        <span class="map-legend-label">销量热度</span>
        <div class="map-legend-scale no-data">
          <span>本月暂无国家销量</span>
        </div>
      </div>
    `;
  }
  return `
    <div class="map-legend">
      <span class="map-legend-label">销量热度</span>
      <div class="map-legend-scale">
        <span>低</span>
        <div class="map-legend-bar"></div>
        <span>${maxSales}</span>
      </div>
    </div>
  `;
}

function paintSalesMap(countrySummary) {
  const root = document.getElementById("dragy-map-board");
  const svg = root.querySelector("svg");
  const overlay = root.querySelector(".atlas-overlay");
  if (!svg || !overlay) return;

  const viewBoxRaw = svg.getAttribute("viewBox");
  if (!viewBoxRaw) return;
  const [viewX, viewY, viewWidth, viewHeight] = viewBoxRaw.split(/\s+/).map(Number);
  const maxSales = Math.max(...countrySummary.map((item) => item.sales), 0);

  countrySummary.forEach((item) => {
    const mapId = MARKET_TO_MAP_ID[item.marketplace];
    if (!mapId) return;
    const node = svg.querySelector(`#${mapId}`);
    if (!node) return;

    if (item.sales > 0 && maxSales > 0) {
      const weight = 0.16 + ((item.sales / maxSales) * 0.84);
      node.classList.add("is-active-market");
      node.style.fill = mixHexColors(MAP_FILL_LOW, MAP_FILL_HIGH, weight);
      node.style.stroke = mixHexColors(MAP_STROKE_LOW, MAP_STROKE_HIGH, weight);
      node.style.strokeWidth = "1.2";

      const box = node.getBBox();
      const centerX = (((box.x + (box.width / 2)) - viewX) / viewWidth) * 100;
      const centerY = (((box.y + (box.height / 2)) - viewY) / viewHeight) * 100;
      const offset = MAP_LABEL_OFFSETS[item.marketplace] || { x: 0, y: 0 };
      const label = document.createElement("div");
      label.className = "map-country-tag";
      label.style.left = `${centerX + offset.x}%`;
      label.style.top = `${centerY + offset.y}%`;
      label.innerHTML = `
        <span>${item.marketplace}</span>
        <strong>${item.sales}</strong>
      `;
      overlay.appendChild(label);
      return;
    }

    node.classList.add("is-tracked-market");
  });
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
  const heroTitle = isPortfolioView() ? "dragy 品牌销量总览" : `${getScopeName(state.scopeId)} 销量聚焦`;
  const heroNote = isPortfolioView()
    ? "先用全部产品模式判断 dragy 这 5 个产品组的体量、结构和主力国家，再进入单产品模式深看某一条产品线。"
    : `当前已经进入 ${getScopeName(state.scopeId)} 的单产品视图，下面所有图表和国家表都只围绕这一条产品线展开，不再混入其他产品。`;
  document.getElementById("dragy-last-updated").textContent = payload.generatedAt;
  document.getElementById("dragy-hero-card").innerHTML = `
    <div class="product-hero-copy">
      <p class="kicker">Brand Overview</p>
      <h2>${heroTitle}</h2>
      <p class="product-hero-note">${heroNote}</p>
      <div class="product-hero-meta">${payload.recent30Start} 至 ${payload.recent30End} · 近 12 个月可钻取 · 5 个产品联动国家和月份</div>
    </div>
    <div class="product-hero-media">
      <img class="product-showcase-image" src="${payload.heroImage}" alt="dragy 主图">
    </div>
  `;
}

function renderScopeTabs() {
  const portfolioView = isPortfolioView();
  const tabs = state.payload.scopeOrder
    .map((scopeId) => {
      const item = state.payload.scopes[scopeId];
      const active = scopeId === state.scopeId ? "active" : "";
      const metaLine = item.meta.label;
      return `
        <button class="product-chip ${active}" type="button" data-scope="${scopeId}">
          <div class="product-chip-copy">
            <div class="product-name">${scopeId === "global" ? "全部产品" : item.meta.name}</div>
            <div class="product-asin">${metaLine}</div>
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
}

function renderSummary() {
  const scope = getScope();
  const recent = scope.recent30;
  const latestMonth = scope.monthlySeries[scope.monthlySeries.length - 1];
  const latestMonthData = scope.monthDrilldowns[state.payload.defaultMonth] || latestMonth;
  const topCountry = [...recent.countrySummary].sort((a, b) => b.sales - a.sales)[0];
  const fallbackTopCountry = latestMonthData
    ? [...latestMonthData.countrySummary].sort((a, b) => b.sales - a.sales)[0]
    : null;
  const displayTopCountry = topCountry && topCountry.sales > 0 ? topCountry : fallbackTopCountry;
  const latestMonthNote = latestMonth
    ? `${latestMonth.label} 月销量${scope.latestMonthEstimatedSales > 0 ? ` · 含 ${scope.latestMonthEstimatedSales} 件 SellerSprite 月估值回填` : ""}`
    : "-";

  document.getElementById("dragy-summary").innerHTML = `
    <article class="summary-card">
      <div class="kicker">Selected Scope</div>
      <div class="summary-value">${getScopeName(state.scopeId)}</div>
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
      <div class="summary-note">${latestMonthNote}</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Lead Country</div>
      <div class="summary-value">${displayTopCountry ? displayTopCountry.country : "-"}</div>
      <div class="summary-note">
        ${displayTopCountry
          ? (topCountry && topCountry.sales > 0
            ? `${displayTopCountry.sales} 件 / 30天`
            : `${displayTopCountry.sales} 件 / ${state.payload.defaultMonth.replace("-", "/")} 月估值`)
          : "暂无国家销量"}
      </div>
    </article>
  `;
}

function renderComparisonSection() {
  const panel = document.getElementById("dragy-comparison-panel");
  if (!isPortfolioView()) {
    panel.classList.add("is-focused");
    document.getElementById("dragy-line-cards").innerHTML = "";
    return;
  }

  panel.classList.remove("is-focused");
  const cards = state.payload.scopeOrder.filter((scopeId) => scopeId !== "global")
    .map((scopeId) => {
      const scope = state.payload.scopes[scopeId];
      const recent = scope.recent30;
      const topCountry = [...recent.countrySummary].sort((a, b) => b.sales - a.sales)[0];
      const latestMonth = scope.monthDrilldowns[state.payload.defaultMonth];
      const fallbackTopCountry = latestMonth
        ? [...latestMonth.countrySummary].sort((a, b) => b.sales - a.sales)[0]
        : null;
      const displayTopCountry = topCountry && topCountry.sales > 0 ? topCountry : fallbackTopCountry;
      const markets = recent.countrySummary
        .filter((item) => item.sales > 0)
        .map((item) => item.marketplace)
        .join(" · ");
      const fallbackMarkets = latestMonth
        ? latestMonth.countrySummary.filter((item) => item.sales > 0).map((item) => item.marketplace).join(" · ")
        : "";
      return `
        <article class="detail-card line-card" data-scope-card="${scopeId}">
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
              <strong>${displayTopCountry && displayTopCountry.sales > 0 ? displayTopCountry.country : "-"}</strong>
            </div>
            <div class="line-card-stat">
              <span>均价</span>
              <strong>${formatCurrency(recent.avgPrice)}</strong>
            </div>
          </div>
          <div class="line-card-markets">
            ${markets || (scope.hasEstimateGap ? `当前 30 天没有逐日销量，${state.payload.defaultMonth.replace("-", "/")} 月估值国家：${fallbackMarkets || "暂无"}` : "当前没有抓到有效国家销量")}
          </div>
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
  const detailScopeIds = state.payload.scopeOrder.filter((scopeId) => scopeId !== "global");
  dragyRecentChart = new Chart(document.getElementById("dragy-recent-chart"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.date.slice(5)),
      datasets: isGlobal
        ? detailScopeIds.map((scopeId) => ({
            label: state.payload.scopes[scopeId].meta.name,
            data: rows.map((row) => row.lines[scopeId]),
            backgroundColor: DRAGY_COLORS[scopeId],
            borderRadius: 6,
            stack: "sales",
          }))
        : [
            {
              label: getScopeName(state.scopeId),
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
          ${isGlobal ? detailScopeIds.map((scopeId) => `<th>${state.payload.scopes[scopeId].meta.name}</th>`).join("") : ""}
          ${markets.map((market) => `<th>${market}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${[...rows].reverse().map((row) => `
          <tr>
            <td>${row.date}</td>
            <td>${row.sales}</td>
            ${isGlobal ? detailScopeIds.map((scopeId) => `<td>${row.lines[scopeId]}</td>`).join("") : ""}
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
  const detailScopeIds = state.payload.scopeOrder.filter((scopeId) => scopeId !== "global");
  const hasEstimatedMonthGap = Number(monthData.estimatedSales || 0) > 0;

  destroyChart(dragyMonthlyChart);
  dragyMonthlyChart = new Chart(document.getElementById("dragy-monthly-chart"), {
    type: "bar",
    data: {
      labels: months.map((item) => item.label.slice(2)),
      datasets: [
        {
          label: getScopeName(state.scopeId),
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
    ${hasEstimatedMonthGap ? `
      <div class="daily-metric estimate-gap">
        <span>月估值回填</span>
        <strong>${monthData.estimatedSales}</strong>
      </div>
    ` : ""}
  `;

  destroyChart(dragyMonthDailyChart);
  dragyMonthDailyChart = new Chart(document.getElementById("dragy-month-daily-chart"), {
    type: "bar",
    data: {
      labels: rows.map((row) => row.date.slice(8)),
      datasets: isGlobal
        ? detailScopeIds.map((scopeId) => ({
            label: state.payload.scopes[scopeId].meta.name,
            data: rows.map((row) => row.lines[scopeId]),
            backgroundColor: DRAGY_COLORS[scopeId],
            stack: "month-sales",
            borderRadius: 6,
          }))
        : [
            {
              label: getScopeName(state.scopeId),
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
          ${isGlobal ? detailScopeIds.map((scopeId) => `<th>${state.payload.scopes[scopeId].meta.name}</th>`).join("") : ""}
          ${markets.map((market) => `<th>${market}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${[...rows].reverse().map((row) => `
          <tr>
            <td>${row.date}</td>
            <td>${row.sales}</td>
            ${isGlobal ? detailScopeIds.map((scopeId) => `<td>${row.lines[scopeId]}</td>`).join("") : ""}
            ${markets.map((market) => `<td>${row.countries[market].sales}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="month-footnote">
      当前选中 ${monthData.label}，有销量国家 ${activeCountries} 个。
      ${hasEstimatedMonthGap ? `其中 ${monthData.estimatedSales} 件来自 SellerSprite 月估值回填，当前没有对应的逐日日序列。` : ""}
    </div>
  `;
}

function renderMapSection() {
  const scope = getScope();
  const monthData = getSelectedMonthData();
  const maxSales = Math.max(...monthData.countrySummary.map((item) => item.sales), 1);
  const rankedCountries = [...monthData.countrySummary]
    .filter((item) => item.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 3);

  document.getElementById("dragy-map-board").innerHTML = `
    <div class="country-topline">
      ${rankedCountries.length ? rankedCountries.map((item, index) => `
        <div class="country-pill">
          <span>Top ${index + 1}</span>
          <strong>${item.country}</strong>
          <div class="summary-note">${monthData.label} · ${item.sales} 件</div>
        </div>
      `).join("") : `
        <div class="country-pill">
          <span>Top Country</span>
          <strong>暂无销量</strong>
          <div class="summary-note">${monthData.label} 当前没有国家销量</div>
        </div>
      `}
    </div>
    ${buildMapLegend(maxSales)}
    <div class="atlas-surface">
      <div class="atlas-map-frame">
        ${WORLD_MAP_HTML}
      </div>
      <div class="atlas-overlay"></div>
    </div>
    <div class="map-caption">当前地图展示的是 ${getScopeName(state.scopeId)} 在 ${monthData.label} 的国家销量分布。底图基于公开 SVG 世界地图资源。</div>
  `;
  paintSalesMap(monthData.countrySummary);

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

function renderTodaySection() {
  const scope = getScope();
  const rows = scope.recent30.dailyRows || [];
  const latest = rows[rows.length - 1];
  if (!latest) {
    document.getElementById("dragy-today-global-strip").innerHTML = `
      <div class="empty-state">当前没有可展示的今日销量快照。</div>
    `;
    document.getElementById("dragy-today-country-grid").innerHTML = "";
    return;
  }

  const countryRows = Object.entries(latest.countries || {})
    .map(([marketplace, item]) => ({
      marketplace,
      sales: item.sales || 0,
      amount: item.amount || 0,
      price: item.price || 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  document.getElementById("dragy-today-global-strip").innerHTML = `
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
      <strong>${countryRows.filter((item) => item.sales > 0).length}</strong>
    </div>
  `;

  document.getElementById("dragy-today-country-grid").innerHTML = countryRows
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

function renderSidebar() {
  const scope = getScope();
  document.getElementById("dragy-image-panel").innerHTML = `
    <div class="product-image-panel">
      <img class="product-showcase-image" src="${scope.heroImage || state.payload.heroImage}" alt="${scope.meta.name} 产品图">
      <div class="product-image-caption">${getScopeName(state.scopeId)} 当前使用销量最高的产品图作为视觉封面。</div>
    </div>
  `;

  document.getElementById("dragy-product-list").innerHTML = scope.products
    .map(
      (item) => `
        <div class="tracking-item">
          <strong>${item.country} · ${item.asin}</strong>
          <p>${item.title}</p>
          <div class="tracking-tag ${item.hasDailySeriesGap ? "estimated" : "live"}">
            30天 ${item.recent30Sales}
            · ${item.hasDailySeriesGap ? `本月估值 ${item.estimatedCurrentMonthSales}` : `本月 ${item.currentMonthSales}`}
            · ${formatCurrency(item.price)}
          </div>
          ${item.hasDailySeriesGap ? `<p class="tracking-subnote">SellerSprite 品牌列表返回了本月估值，但这个 ASIN 的日序列接口当前没有返回逐日销量。</p>` : ""}
        </div>
      `,
    )
    .join("");

  const notes = [...state.payload.notes];
  if (scope.hasEstimateGap) {
    notes.unshift(`${getScopeName(state.scopeId)} 当前包含 ${scope.latestMonthEstimatedSales} 件 SellerSprite 月估值回填。月销量可参考，但这部分没有对应的逐日日序列。`);
  }
  document.getElementById("dragy-notes").innerHTML = notes
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
  document.body.classList.toggle("scope-focused", !isPortfolioView());
  renderHero();
  renderScopeTabs();
  renderSummary();
  renderTodaySection();
  renderComparisonSection();
  renderRecentSection();
  renderMonthSection();
  renderMapSection();
  renderSidebar();
}

loadDragyData().then((payload) => {
  state.payload = payload;
  state.month = payload.defaultMonth;
  ensureSelectedMonth();
  renderDynamic();
});
