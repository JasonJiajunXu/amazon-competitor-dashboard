function filterReportsForView(payload, viewId) {
  const config = payload.viewConfig[viewId];
  if (!config) return [];
  if (Array.isArray(config.reportIds) && config.reportIds.length) {
    return payload.reports.filter((report) => config.reportIds.includes(report.report_id));
  }
  if (viewId === "all") return payload.reports;
  return payload.reports.filter((report) => report.category === viewId);
}

function formatBoardCount(count) {
  return `${count} 份报告`;
}

function buildThumbStrip(reports, fallbackImage) {
  const items = reports
    .filter((report) => report.image_url)
    .slice(0, 3)
    .map((report) => `
      <img class="board-thumb" src="${report.image_url}" alt="${report.title}">
    `)
    .join("");

  if (items) {
    return `<div class="board-thumb-row">${items}</div>`;
  }

  return `
    <div class="board-thumb-row">
      <img class="board-thumb" src="${fallbackImage}" alt="">
    </div>
  `;
}

function buildBoardCard(view, reports, options = {}) {
  const lead = reports[0];
  const href = `./report.html?view=${view.id}`;
  const heroImage = lead?.image_url || options.fallbackImage || "./assets/products/dragy.jpg";
  const thumbStrip = buildThumbStrip(reports, heroImage);
  const productNames = reports.slice(0, 3).map((report) => report.title).join(" · ");

  return `
    <a class="board-card ${options.variant || ""}" href="${href}">
      <div class="board-card-media">
        <img class="board-card-hero" src="${heroImage}" alt="${view.title}">
        ${thumbStrip}
      </div>
      <div class="board-card-copy">
        <div class="board-card-topline">
          <span class="board-role">${options.role || view.label}</span>
          <span class="board-count">${formatBoardCount(reports.length)}</span>
        </div>
        <h3 class="board-card-title">${view.shortTitle || view.title}</h3>
        <p class="board-card-desc">${view.description}</p>
        <div class="board-card-meta">
          <div class="board-meta-item">
            <span>打开后会看到</span>
            <strong>${lead ? lead.title : "当前无数据"}</strong>
          </div>
          <div class="board-meta-item">
            <span>适合场景</span>
            <strong>${options.useCase || "进入对应类目继续筛选与切换"}</strong>
          </div>
        </div>
        <div class="board-card-foot">
          <span>${productNames || "当前没有产品图片可展示"}</span>
          <span class="board-card-arrow">Open</span>
        </div>
      </div>
    </a>
  `;
}

function buildSpecialCard(entry) {
  return `
    <a class="board-card board-card-special" href="${entry.href}">
      <div class="board-card-media">
        <img class="board-card-hero" src="${entry.image}" alt="${entry.title}">
      </div>
      <div class="board-card-copy">
        <div class="board-card-topline">
          <span class="board-role">${entry.eyebrow}</span>
          <span class="board-count">${entry.badge}</span>
        </div>
        <h3 class="board-card-title">${entry.title}</h3>
        <p class="board-card-desc">${entry.description}</p>
        <div class="board-card-meta">
          <div class="board-meta-item">
            <span>核心价值</span>
            <strong>${entry.value}</strong>
          </div>
          <div class="board-meta-item">
            <span>最适合</span>
            <strong>${entry.useCase}</strong>
          </div>
        </div>
        <div class="board-card-foot">
          <span>${entry.footnote}</span>
          <span class="board-card-arrow">Open</span>
        </div>
      </div>
    </a>
  `;
}

function renderHome(payload) {
  const { viewConfig, refreshStatus } = payload;
  const featuredEntries = [
    {
      title: "Racebox 销量纵览",
      description: "查看今日全球销量、各国家拆分，以及 Racebox 的逐日和历史月度表现。",
      href: "./racebox.html",
      image: "./assets/products/racebox.jpg",
      eyebrow: "Signature Board",
      badge: "Daily depth",
      value: "把单产品的日销量读透",
      useCase: "先盯住一个核心产品看日波动",
      footnote: "适合每天追一个重点单品。",
    },
    {
      title: "dragy 全球销量情报",
      description: "从品牌组合切到单产品，追踪 dragy 各型号、各国家和月度/日度联动表现。",
      href: "./dragy.html",
      image: "./assets/products/dragy.jpg",
      eyebrow: "Brand Intelligence",
      badge: "Portfolio view",
      value: "把品牌线拆开看谁在带量",
      useCase: "先看品牌，再落到具体型号",
      footnote: "适合分析一个品牌内的多条产品线。",
    },
  ];

  const featuredGrid = document.getElementById("featured-grid");
  const primaryGrid = document.getElementById("primary-grid");
  const categoryGrid = document.getElementById("category-grid");

  featuredGrid.innerHTML = featuredEntries.map(buildSpecialCard).join("");

  primaryGrid.innerHTML = [
    buildBoardCard(viewConfig.overview, filterReportsForView(payload, "overview"), {
      variant: "board-card-primary",
      role: "Start here",
      useCase: "先判断今天哪个赛道值得继续看",
      fallbackImage: "./assets/products/racebox.jpg",
    }),
    buildBoardCard(viewConfig.all, filterReportsForView(payload, "all"), {
      variant: "board-card-primary",
      role: "Full library",
      useCase: "已经知道要看什么，直接逐个切换产品",
      fallbackImage: "./assets/products/dragy.jpg",
    }),
  ].join("");

  categoryGrid.innerHTML = [
    buildBoardCard(viewConfig.golf, filterReportsForView(payload, "golf"), {
      role: "Category board",
      useCase: "看高尔夫训练与雷达设备",
      fallbackImage: "./assets/products/dragy.jpg",
    }),
    buildBoardCard(viewConfig.baseball, filterReportsForView(payload, "baseball"), {
      role: "Category board",
      useCase: "看测速枪与棒球训练设备",
      fallbackImage: "./assets/products/racebox.jpg",
    }),
    buildBoardCard(viewConfig.shooting, filterReportsForView(payload, "shooting"), {
      role: "Category board",
      useCase: "看射击测速设备与代际切换",
      fallbackImage: "./assets/products/dragy.jpg",
    }),
    buildBoardCard(viewConfig["brand-lines"], filterReportsForView(payload, "brand-lines"), {
      role: "Category board",
      useCase: "看品牌下多条产品线的对比",
      fallbackImage: "./assets/products/dragy.jpg",
    }),
  ].join("");

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
