function renderHome(payload) {
  const { viewConfig, refreshStatus } = payload;
  const order = ["overview", "golf", "baseball", "shooting", "brand-lines", "all"];
  const reportByCategory = payload.reports.reduce((acc, report) => {
    acc[report.category] ||= report;
    return acc;
  }, {});
  const extraEntries = [
    {
      id: "racebox-april",
      title: "Racebox 销量纵览",
      description: "查看今日全球销量、各国家拆分，以及 4 月逐日与历史月度表现。",
      href: "./racebox.html",
      image: "./assets/products/racebox.jpg",
      eyebrow: "Signature Board",
    },
    {
      id: "dragy-global",
      title: "dragy 全球销量情报",
      description: "从全部产品切到单产品，查看今日全球销量、国家分布与近一年月度钻取。",
      href: "./dragy.html",
      image: "./assets/products/dragy.jpg",
      eyebrow: "Brand Intelligence",
    },
  ];
  const grid = document.getElementById("entry-grid");

  const defaultEntries = order
    .map((key) => {
      const view = viewConfig[key];
      const sampleReport = reportByCategory[key];
      return `
        <a class="entry-button" href="./report.html?view=${view.id}">
          <div class="entry-left">
            <img class="entry-thumb" src="${sampleReport?.image_url || './assets/products/dragy.jpg'}" alt="${view.title}">
            <div>
              <div class="entry-eyebrow">Sales Board</div>
              <div class="entry-title">${view.title}</div>
              <div class="entry-meta">${view.description}</div>
            </div>
          </div>
          <div class="entry-arrow">→</div>
        </a>
      `;
    });

  const specialEntries = extraEntries.map(
    (entry) => `
      <a class="entry-button special-entry" href="${entry.href}">
        <div class="entry-left">
          <img class="entry-thumb" src="${entry.image}" alt="${entry.title}">
          <div>
            <div class="entry-eyebrow">${entry.eyebrow}</div>
            <div class="entry-title">${entry.title}</div>
            <div class="entry-meta">${entry.description}</div>
          </div>
        </div>
        <div class="entry-arrow">→</div>
      </a>
    `,
  );

  grid.innerHTML = [...specialEntries, ...defaultEntries]
    .join("");

  document.getElementById("last-updated").textContent = refreshStatus.lastUpdated;
  document.getElementById("last-updated-note").textContent = refreshStatus.note;
  document.getElementById("tracked-report-count").textContent = refreshStatus.trackedReportCount;
  document.getElementById("configured-asin-count").textContent = refreshStatus.configuredAsinCount;
  document.getElementById("tracked-series-count").textContent = refreshStatus.trackedSeriesCount;
  document.getElementById("pending-report-count").textContent = refreshStatus.pendingReportCount;
  document.getElementById("refresh-log").innerHTML = refreshStatus.logs
    .map(
      (item) => `
        <div class="log-item">
          <div class="log-time">${item.time}</div>
          <div class="log-tag">${item.tag}</div>
          <div class="status-subline">${item.description}</div>
        </div>
      `,
    )
    .join("");
}

loadDashboardData().then(renderHome);
