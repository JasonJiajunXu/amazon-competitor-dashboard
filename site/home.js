const HOME_GROUPS = [
  {
    title: "全部",
    note: "先看完整产品库，再决定往哪个赛道继续深入。",
    items: [
      {
        title: "全部产品",
        description: "查看当前全部产品与品牌的详情页入口。",
        href: "./report.html?view=all",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Full catalog",
      },
    ],
  },
  {
    title: "赛车",
    note: "适合先看赛车测速相关产品的全球销量和国家分布。",
    items: [
      {
        title: "dragy",
        description: "品牌多型号销量页，可从全部产品切到具体型号和国家。",
        href: "./dragy.html",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Brand page",
      },
      {
        title: "Racebox",
        description: "单产品销量纵览，包含今日销量、逐日变化和历史月度表现。",
        href: "./racebox.html",
        image: "./assets/products/racebox.jpg",
        eyebrow: "Product page",
      },
    ],
  },
  {
    title: "棒球",
    note: "聚焦测速枪和训练设备，适合看训练器材赛道的变化。",
    items: [
      {
        title: "Tag one",
        description: "直接进入 TAG ONE 详情页。",
        href: "./report.html?view=baseball&report=tag",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
      {
        title: "Velocity gun",
        description: "直接进入 Velocity 详情页。",
        href: "./report.html?view=baseball&report=bushnell",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
    ],
  },
  {
    title: "高尔夫",
    note: "把高尔夫雷达、发球监测和训练设备放在一起看。",
    items: [
      {
        title: "Garmin Approach R10",
        description: "直接进入 Garmin Approach R10 详情页。",
        href: "./report.html?view=golf&report=garmin_r10",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
      {
        title: "Rapsodo MLM",
        description: "直接进入 Rapsodo MLM 详情页。",
        href: "./report.html?view=golf&report=rapsodo_mlm",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
      {
        title: "Rapsodo MLM Pro",
        description: "直接进入 Rapsodo Golf 组合页。",
        href: "./report.html?view=brand-lines&report=rapsodo",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Brand line",
      },
      {
        title: "Blue Tees",
        description: "直接进入 Blue Tees 详情页。",
        href: "./report.html?view=golf&report=blue_tees",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
    ],
  },
  {
    title: "射击",
    note: "聚焦弹道测速设备，适合看射击测速赛道和代际切换。",
    items: [
      {
        title: "Xero C1 pro & C2",
        description: "直接进入 Xero C1 Pro & C2 详情页。",
        href: "./report.html?view=shooting&report=garmin_xero",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
      {
        title: "Rangecraft",
        description: "直接进入 Rangecraft 详情页。",
        href: "./report.html?view=shooting&report=rangecraft",
        image: "./assets/products/dragy.jpg",
        eyebrow: "Product page",
      },
    ],
  },
];

function findReport(payload, reportId) {
  return payload.reports.find((report) => report.report_id === reportId);
}

function resolveImage(payload, item) {
  if (item.href.includes("dragy.html") || item.href.includes("racebox.html")) {
    return item.image;
  }
  const match = item.href.match(/report=([^&]+)/);
  const reportId = match?.[1];
  const report = reportId ? findReport(payload, reportId) : null;
  return report?.image_url || item.image || "./assets/products/dragy.jpg";
}

function renderGroup(payload, group) {
  const cards = group.items.map((item) => `
    <a class="category-product-card" href="${item.href}">
      <img class="category-product-thumb" src="${resolveImage(payload, item)}" alt="${item.title}">
      <div class="category-product-copy">
        <div class="entry-eyebrow">${item.eyebrow}</div>
        <div class="category-product-title">${item.title}</div>
        <div class="category-product-desc">${item.description}</div>
      </div>
    </a>
  `).join("");

  return `
    <section class="category-card">
      <div class="category-card-head">
        <div class="category-card-copy">
          <p class="kicker">${group.title}</p>
          <h3>${group.title}</h3>
          <p>${group.note}</p>
        </div>
        <div class="category-card-count">${group.items.length} items</div>
      </div>
      <div class="category-product-grid">${cards}</div>
    </section>
  `;
}

function renderHome(payload) {
  document.getElementById("entry-grid").innerHTML = HOME_GROUPS.map((group) => renderGroup(payload, group)).join("");

  const { refreshStatus } = payload;
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
