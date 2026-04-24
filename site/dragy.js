let dragyCountryChart;
let dragyTrendChart;

const COUNTRY_COLORS = {
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

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function loadDragyData() {
  return fetch("./data/dragy_dashboard.json").then((response) => response.json());
}

function createBarValuePlugin() {
  return {
    id: "dragy-bar-values",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "700 11px Manrope";
      ctx.fillStyle = "#576070";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          if (!value) return;
          const point = element.tooltipPosition();
          ctx.textAlign = "center";
          ctx.fillText(String(value), point.x, point.y - 8);
        });
      });
      ctx.restore();
    },
  };
}

function createLastPointLabelPlugin() {
  return {
    id: "dragy-last-point-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "700 11px Manrope";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        const lastIndex = dataset.data.length - 1;
        const lastPoint = meta.data[lastIndex];
        const lastValue = dataset.data[lastIndex];
        if (!lastPoint || lastValue == null) return;
        const position = lastPoint.tooltipPosition();
        ctx.fillStyle = dataset.borderColor;
        ctx.textAlign = "left";
        ctx.fillText(`${dataset.label} ${lastValue}`, position.x + 8, position.y - 4);
      });
      ctx.restore();
    },
  };
}

function renderDragy(payload) {
  const activeCountries = payload.countrySummary.filter(
    (item) => item.trackedProducts > 0 || item.totalSales30d > 0,
  );
  const latestRow = payload.dailyRows[payload.dailyRows.length - 1];
  const totalSales30d = payload.dailyRows.reduce((sum, row) => sum + row.globalSales, 0);
  const totalAmount30d = payload.dailyRows.reduce((sum, row) => sum + row.globalAmount, 0);
  const trackedCount = payload.trackedProducts.length;
  const avgPrice30d = totalSales30d ? Math.round(totalAmount30d / totalSales30d) : 0;

  document.getElementById("dragy-last-updated").textContent = payload.generatedAt;
  document.getElementById("dragy-hero-card").innerHTML = `
    <div class="product-hero-copy">
      <p class="kicker">Brand Overview</p>
      <h2>${payload.title}</h2>
      <p class="product-hero-note">本页按 SellerSprite 当前可追踪到的 dragy 主机型汇总，先看全球近 30 天国家销量，再往下看各国家覆盖产品和逐日明细。</p>
      <div class="product-hero-meta">${payload.windowStart} 至 ${payload.windowEnd} · 主机型 ${trackedCount} 个 · 活跃国家 ${activeCountries.length} 个</div>
    </div>
    <div class="product-hero-media">
      <img class="product-showcase-image" src="${payload.heroImage}" alt="dragy 主图">
    </div>
  `;

  document.getElementById("dragy-summary").innerHTML = `
    <article class="summary-card">
      <div class="kicker">30D Global Sales</div>
      <div class="summary-value">${totalSales30d}</div>
      <div class="summary-note">近 30 天全球主机型总销量</div>
    </article>
    <article class="summary-card">
      <div class="kicker">30D Revenue</div>
      <div class="summary-value">$${formatCompact(totalAmount30d)}</div>
      <div class="summary-note">近 30 天全球销售额</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Countries Live</div>
      <div class="summary-value">${activeCountries.length}</div>
      <div class="summary-note">当前有销量或在售主机型的国家</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Avg Price</div>
      <div class="summary-value">$${avgPrice30d}</div>
      <div class="summary-note">近 30 天全球均价</div>
    </article>
  `;

  document.getElementById("dragy-daily-strip").innerHTML = `
    <div class="daily-metric">
      <span>最近日期</span>
      <strong>${payload.latestDate}</strong>
    </div>
    <div class="daily-metric">
      <span>最近全球销量</span>
      <strong>${latestRow?.globalSales ?? "-"}</strong>
    </div>
    <div class="daily-metric">
      <span>最近全球销售额</span>
      <strong>$${formatCompact(latestRow?.globalAmount ?? 0)}</strong>
    </div>
    <div class="daily-metric">
      <span>主力国家</span>
      <strong>${activeCountries[0]?.country ?? "-"}</strong>
    </div>
  `;

  document.getElementById("dragy-country-cards").innerHTML = payload.countrySummary
    .map(
      (item) => `
        <article class="country-card ${item.totalSales30d > 0 ? "active" : "inactive"}">
          <div class="country-card-head">
            <strong>${item.country}</strong>
            <span>${item.marketplace}</span>
          </div>
          <div class="country-card-main">${item.totalSales30d}</div>
          <div class="country-card-note">近 30 天销量 · 最新一天 ${item.latestSales}</div>
          <div class="country-card-sub">主机型 ${item.trackedProducts} 个 · 月销量参考 ${item.monthlyUnits}</div>
        </article>
      `,
    )
    .join("");

  if (dragyCountryChart) dragyCountryChart.destroy();
  dragyCountryChart = new Chart(document.getElementById("dragy-country-chart"), {
    type: "bar",
    data: {
      labels: activeCountries.map((item) => item.country),
      datasets: [
        {
          label: "近 30 天销量",
          data: activeCountries.map((item) => item.totalSales30d),
          backgroundColor: activeCountries.map((item) => COUNTRY_COLORS[item.marketplace] || "#5d84f1"),
          borderRadius: 12,
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
    plugins: [createBarValuePlugin()],
  });

  if (dragyTrendChart) dragyTrendChart.destroy();
  dragyTrendChart = new Chart(document.getElementById("dragy-trend-chart"), {
    type: "line",
    data: {
      labels: payload.dailyRows.map((row) => row.date.slice(5)),
      datasets: activeCountries.map((item) => ({
        label: item.marketplace,
        data: payload.dailyRows.map((row) => row.countries[item.marketplace]?.sales ?? 0),
        borderColor: COUNTRY_COLORS[item.marketplace] || "#5d84f1",
        backgroundColor: "transparent",
        tension: 0.28,
        borderWidth: 2.5,
        pointRadius: 2.5,
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
    plugins: [createLastPointLabelPlugin()],
  });

  document.getElementById("dragy-notes").innerHTML = payload.notes
    .map(
      (note) => `
        <div class="insight-item">
          <p>${note}</p>
        </div>
      `,
    )
    .join("");

  document.getElementById("dragy-country-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>国家</th>
          <th>站点</th>
          <th>30天销量</th>
          <th>30天销售额</th>
          <th>30天均价</th>
          <th>最近单日销量</th>
          <th>主机型数</th>
          <th>本月参考销量</th>
        </tr>
      </thead>
      <tbody>
        ${payload.countrySummary.map((item) => `
          <tr>
            <td>${item.country}</td>
            <td>${item.marketplace}</td>
            <td>${item.totalSales30d}</td>
            <td>$${item.totalAmount30d.toLocaleString()}</td>
            <td>$${item.avgPrice30d}</td>
            <td>${item.latestSales}</td>
            <td>${item.trackedProducts}</td>
            <td>${item.monthlyUnits}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.getElementById("dragy-image-panel").innerHTML = `
    <div class="product-image-panel">
      <img class="product-showcase-image" src="${payload.heroImage}" alt="dragy 产品图">
      <div class="product-image-caption">当前使用销量最高的 dragy 主机型主图做品牌封面。</div>
    </div>
  `;

  document.getElementById("dragy-product-list").innerHTML = payload.trackedProducts
    .map(
      (item) => `
        <div class="tracking-item">
          <strong>${item.country} · ${item.asin}</strong>
          <p>${item.title}</p>
          <div class="tracking-tag live">月销量 ${item.monthlyUnits} · 价格 ${item.price}</div>
        </div>
      `,
    )
    .join("");

  const shownMarkets = activeCountries.map((item) => item.marketplace);
  document.getElementById("dragy-daily-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>全球销量</th>
          ${shownMarkets.map((market) => `<th>${market}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${[...payload.dailyRows].reverse().map((row) => `
          <tr>
            <td>${row.date}</td>
            <td>${row.globalSales}</td>
            ${shownMarkets.map((market) => `<td>${row.countries[market]?.sales ?? 0}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

loadDragyData().then(renderDragy);
