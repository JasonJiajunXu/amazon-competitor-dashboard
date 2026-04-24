function renderHome(payload) {
  const { viewConfig, refreshStatus } = payload;
  const order = ["overview", "golf", "baseball", "shooting", "brand-lines", "all"];
  const extraEntries = [
    {
      id: "racebox-april",
      title: "Racebox 4 月日销量页",
      description: "保留原月度数据，并单独查看 Racebox 4 月每天销量。",
      href: "./racebox.html",
    },
    {
      id: "dragy-global",
      title: "dragy 全球 30 天销量页",
      description: "放在 Racebox 下面，按国家查看 dragy 近 30 天全球日销量。",
      href: "./dragy.html",
    },
  ];
  const grid = document.getElementById("entry-grid");

  const defaultEntries = order
    .map((key, index) => {
      const view = viewConfig[key];
      return `
        <a class="entry-button ${index === 1 ? "active" : ""}" href="./report.html?view=${view.id}">
          <div class="entry-left">
            <div class="entry-icon">${index + 1}</div>
            <div>
              <div class="entry-title">${view.title}</div>
              <div class="entry-meta">${view.description}</div>
            </div>
          </div>
          <div class="entry-arrow">→</div>
        </a>
      `;
    });

  const specialEntries = extraEntries.map(
    (entry, index) => `
      <a class="entry-button special-entry" href="${entry.href}">
        <div class="entry-left">
          <div class="entry-icon">R${index + 1}</div>
          <div>
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
