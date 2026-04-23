let raceboxDailyChart;

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
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

function renderRacebox(payload) {
  const report = payload.reports.find((item) => item.report_id === "racebox");
  if (!report) return;

  const dailyRows = report.seller_sprite_daily || [];
  const monthlyRows = report.series || [];
  const latest = dailyRows[dailyRows.length - 1];
  const aprilSales = dailyRows.reduce((sum, row) => sum + row.sales, 0);
  const aprilRevenue = dailyRows.reduce((sum, row) => sum + row.amount, 0);
  const avgPrice = Math.round(dailyRows.reduce((sum, row) => sum + row.price, 0) / dailyRows.length);
  const peakDay = dailyRows.reduce((max, row) => (row.sales > (max?.sales || -1) ? row : max), null);

  document.getElementById("racebox-last-updated").textContent = payload.refreshStatus.lastUpdated;
  document.getElementById("racebox-summary").innerHTML = `
    <article class="summary-card">
      <div class="kicker">April Sales</div>
      <div class="summary-value">${aprilSales}</div>
      <div class="summary-note">截至 ${latest?.date || "-"} 的 4 月累计销量</div>
    </article>
    <article class="summary-card">
      <div class="kicker">April Revenue</div>
      <div class="summary-value">$${formatCompact(aprilRevenue)}</div>
      <div class="summary-note">4 月累计销售额</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Avg Price</div>
      <div class="summary-value">$${avgPrice}</div>
      <div class="summary-note">4 月平均成交价</div>
    </article>
    <article class="summary-card">
      <div class="kicker">Peak Day</div>
      <div class="summary-value">${peakDay?.sales || "-"}</div>
      <div class="summary-note">${peakDay?.date || "-"} 是当前 4 月最高单日销量</div>
    </article>
  `;

  document.getElementById("racebox-daily-strip").innerHTML = `
    <div class="daily-metric">
      <span>最近日期</span>
      <strong>${latest?.date || "-"}</strong>
    </div>
    <div class="daily-metric">
      <span>最近单日销量</span>
      <strong>${latest?.sales || "-"}</strong>
    </div>
    <div class="daily-metric">
      <span>最近单日销售额</span>
      <strong>$${formatCompact(latest?.amount || 0)}</strong>
    </div>
    <div class="daily-metric">
      <span>最近 BSR</span>
      <strong>${latest?.bsr?.toLocaleString?.() || "-"}</strong>
    </div>
  `;

  if (raceboxDailyChart) raceboxDailyChart.destroy();
  raceboxDailyChart = new Chart(document.getElementById("racebox-daily-chart"), {
    data: {
      labels: dailyRows.map((row) => row.date.slice(5)),
      datasets: [
        {
          type: "bar",
          label: "日销量",
          data: dailyRows.map((row) => row.sales),
          backgroundColor: report.theme_color || "#e63946",
          borderRadius: 8,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "价格",
          data: dailyRows.map((row) => row.price),
          borderColor: "#b38322",
          backgroundColor: "rgba(179,131,34,0.14)",
          yAxisID: "y1",
          tension: 0.28,
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

  document.getElementById("racebox-daily-table").innerHTML = `
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
      <tbody>
        ${[...dailyRows].reverse().map((row) => `
          <tr>
            <td>${row.date}</td>
            <td>${row.sales}</td>
            <td>$${row.amount.toLocaleString()}</td>
            <td>$${row.price}</td>
            <td>${row.bsr.toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const grouped = {};
  monthlyRows.forEach((row) => {
    grouped[row.series_name] ||= [];
    grouped[row.series_name].push(row);
  });
  const header = (Object.values(grouped)[0] || []).map((row) => `<th>${row.period_label}</th>`).join("");
  const body = Object.entries(grouped).map(([name, rows]) => `
    <tr>
      <td>${name}</td>
      ${rows.map((row) => `<td>${row.value}</td>`).join("")}
    </tr>
  `).join("");
  document.getElementById("racebox-monthly-table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>市场</th>
          ${header}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;

  const sync = report.seller_sprite;
  document.getElementById("racebox-sync-status").innerHTML = sync.items.map((item) => `
    <div class="tracking-item">
      <strong>${item.label}</strong>
      <p>${item.marketplace} · ${item.asin} · ${item.note}</p>
      <div class="tracking-tag ${item.status}">${item.status_text}</div>
    </div>
  `).join("");

  document.getElementById("racebox-insights").innerHTML = `
    <div class="insight-item">
      <strong>月度数据没有丢</strong>
      <p>右侧月度表保留了原来 1-12 月的市场分布数据，新的 4 月逐日数据只是叠加，不会覆盖旧趋势。</p>
    </div>
    <div class="insight-item">
      <strong>4 月目前稳定在 4-7 件/天</strong>
      <p>截至 ${latest?.date || "-"}，Racebox 在美国站 4 月单日销量主要落在 4-6 件，4 月 13 日达到当前峰值 7 件。</p>
    </div>
    <div class="insight-item">
      <strong>价格维持在 $270</strong>
      <p>4 月逐日快照显示成交价基本稳定在 $270，没有像 3 月那样出现明显波动。</p>
    </div>
  `;
}

loadDashboardData().then(renderRacebox);
