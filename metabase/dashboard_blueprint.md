# Metabase 看板设计

## 1. 总览页 `Amazon 竞品调研总览`

- 过滤器
  - `brand`
  - `report_id`
  - `series_name`
  - `metric_kind`
- KPI 行
  - `报告总数`
  - `有销量数据的产品数`
  - `最高 headline sales`
  - `最高 headline revenue`
- 图表
  - 柱状图：按 `report_id` 对比 headline sales
  - 柱状图：按 `report_id` 对比 headline revenue
  - 明细表：`reports` 静态信息表

## 2. 详情页 `单产品/单品牌趋势`

- 过滤器
  - 单选 `report_id`
- 图表
  - 折线/柱状组合：`monthly_series` 按 `period_label` 展示销量、销售额、价格
  - 堆叠柱状图：`segment_units` 系列，例如 Racebox 国家拆分、Rapsodo 双产品线、Garmin Xero 新老代际
  - 表格：`hero_stats` + `report_kpis`
  - 文本卡：`insights`

## 3. 机会页 `增长与爆款识别`

- 衍生指标建议
  - `latest_period_units`
  - `peak_units`
  - `peak_revenue`
  - `price_elasticity_note`，从 `insights` 补充定性说明
- 图表
  - 散点图：`评论量 vs headline sales`
  - 排行表：`峰值月销`
  - 排行表：`峰值销售额`
  - 条件格式表：`2025` 与 `2026 YTD` 对比

## 4. 数据表说明

- `reports`
  - 产品/品牌主表
- `hero_stats`
  - 顶部摘要数字
- `report_kpis`
  - 单页 KPI 卡
- `monthly_series`
  - 所有趋势图数据来源
- `insights`
  - 分析师结论与业务备注

## 5. 推荐公开方式

- Metabase 公共分享链接
- 或嵌入到独立域名页面
- 链接固定，更新来源只换数据库内容，不换 URL
