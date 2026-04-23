create table if not exists reports (
  report_id text primary key,
  brand text,
  brand_since text,
  report_label text,
  title text,
  subtitle text,
  asin_text text,
  primary_asin text,
  asin_count integer,
  image_url text,
  product_tag text,
  theme_color text,
  brand_line text,
  card_title text,
  card_meta text,
  card_description text,
  headline_metric_1_label text,
  headline_metric_1_value text,
  headline_metric_2_label text,
  headline_metric_2_value text
);

create table if not exists hero_stats (
  report_id text not null references reports(report_id),
  position integer not null,
  label text not null,
  value_text text not null,
  value_numeric numeric,
  primary key (report_id, position)
);

create table if not exists report_kpis (
  report_id text not null references reports(report_id),
  position integer not null,
  label text not null,
  value_text text not null,
  value_numeric numeric,
  subtext text,
  tone text,
  primary key (report_id, position)
);

create table if not exists monthly_series (
  report_id text not null references reports(report_id),
  period_label text not null,
  series_name text not null,
  metric_kind text not null,
  value numeric not null
);

create index if not exists monthly_series_report_period_idx
  on monthly_series (report_id, period_label);

create table if not exists insights (
  report_id text not null references reports(report_id),
  position integer not null,
  title text not null,
  body text not null,
  primary key (report_id, position)
);
