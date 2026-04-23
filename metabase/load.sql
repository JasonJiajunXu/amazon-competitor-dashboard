\copy reports from '/absolute/path/to/metabase_dashboard_pack/data/reports.csv' with (format csv, header true, encoding 'utf8');
\copy hero_stats from '/absolute/path/to/metabase_dashboard_pack/data/hero_stats.csv' with (format csv, header true, encoding 'utf8');
\copy report_kpis from '/absolute/path/to/metabase_dashboard_pack/data/kpis.csv' with (format csv, header true, encoding 'utf8');
\copy monthly_series from '/absolute/path/to/metabase_dashboard_pack/data/monthly_series.csv' with (format csv, header true, encoding 'utf8');
\copy insights from '/absolute/path/to/metabase_dashboard_pack/data/insights.csv' with (format csv, header true, encoding 'utf8');
