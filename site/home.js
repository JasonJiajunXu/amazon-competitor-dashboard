function renderHome(payload) {
  const { viewConfig, refreshStatus } = payload;
  const order = ["overview", "golf", "baseball", "shooting", "brand-lines", "all"];
  const grid = document.getElementById("entry-grid");

  grid.innerHTML = order
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
    })
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
