const HOME_GROUPS = [
  {
    label: "all",
    title: "全部",
    note: "先看完整产品库，再决定进入哪条赛道。",
    items: [
      {
        title: "全部产品",
        description: "查看当前全部产品与品牌。",
        href: "./report.html?view=all",
        collection: true,
      },
    ],
  },
  {
    label: "racing",
    title: "赛车",
    note: "查看测速与计时设备的整体表现。",
    items: [
      {
        title: "dragy",
        description: "品牌多型号销量页。",
        href: "./dragy.html",
        image: "./assets/products/dragy.jpg",
      },
      {
        title: "Racebox",
        description: "单产品销量纵览。",
        href: "./racebox.html",
        image: "./assets/products/racebox.jpg",
      },
    ],
  },
  {
    label: "baseball",
    title: "棒球",
    note: "聚焦测速枪和训练设备。",
    items: [
      {
        title: "Tag one",
        description: "TAG ONE 详情页。",
        href: "./report.html?view=baseball&report=tag",
        image: "./assets/products/dragy.jpg",
      },
      {
        title: "Velocity gun",
        description: "Velocity 详情页。",
        href: "./report.html?view=baseball&report=bushnell",
        image: "./assets/products/dragy.jpg",
      },
    ],
  },
  {
    label: "golf",
    title: "高尔夫",
    note: "查看高尔夫雷达与挥杆训练设备。",
    items: [
      {
        title: "Garmin Approach R10",
        description: "Garmin Approach R10 详情页。",
        href: "./report.html?view=golf&report=garmin_r10",
        image: "./assets/products/dragy.jpg",
      },
      {
        title: "Rapsodo MLM",
        description: "Rapsodo MLM 详情页。",
        href: "./report.html?view=golf&report=rapsodo_mlm",
        image: "./assets/products/dragy.jpg",
      },
      {
        title: "Rapsodo MLM Pro",
        description: "Rapsodo Golf 组合页。",
        href: "./report.html?view=brand-lines&report=rapsodo",
        image: "./assets/products/dragy.jpg",
      },
      {
        title: "Blue Tees",
        description: "Blue Tees 详情页。",
        href: "./report.html?view=golf&report=blue_tees",
        image: "./assets/products/dragy.jpg",
      },
    ],
  },
  {
    label: "shooting",
    title: "射击",
    note: "聚焦弹道测速设备与代际切换。",
    items: [
      {
        title: "Xero C1 pro & C2",
        description: "Xero C1 Pro & C2 详情页。",
        href: "./report.html?view=shooting&report=garmin_xero",
        image: "./assets/products/dragy.jpg",
      },
      {
        title: "Rangecraft",
        description: "Rangecraft 详情页。",
        href: "./report.html?view=shooting&report=rangecraft",
        image: "./assets/products/dragy.jpg",
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

function renderThumb(payload, item) {
  if (!item.collection) {
    return `<img class="category-product-thumb" src="${resolveImage(payload, item)}" alt="${item.title}">`;
  }

  const images = payload.reports
    .filter((report) => report.image_url)
    .slice(0, 4)
    .map((report) => `<img class="category-collection-thumb" src="${report.image_url}" alt="${report.title}">`)
    .join("");

  return `<div class="category-product-collage">${images}</div>`;
}

function renderGroup(payload, group) {
  const cards = group.items.map((item) => `
    <a class="category-product-card" href="${item.href}">
      ${renderThumb(payload, item)}
      <div class="category-product-copy">
        <div class="category-product-title">${item.title}</div>
      </div>
    </a>
  `).join("");

  return `
    <section class="category-card">
      <div class="category-card-head">
        <div class="category-card-copy">
          <p class="category-card-label">${group.label}</p>
          <h3>${group.title}</h3>
          <p>${group.note}</p>
        </div>
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
