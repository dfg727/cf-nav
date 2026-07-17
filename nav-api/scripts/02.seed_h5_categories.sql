-- Seed h5 sub categories under the canonical 'h5' root created by 01.migrated_legacy_data.sql.
-- (The old top-level 'worker'/'other'/'h5' inserts that used to live in this file were dropped:
-- 'other'/'h5' are now created once in 01, and 'worker' had no categories/sites pointing at it.)

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '常用',
  1,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = '常用'
    AND pid = (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
);

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '娱乐',
  2,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = '娱乐'
    AND pid = (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
);

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '工具',
  3,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = '工具'
    AND pid = (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
);

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '涨姿势',
  4,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = '涨姿势'
    AND pid = (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
);

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '杂类',
  5,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = '杂类'
    AND pid = (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
);

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  'LanYang',
  6,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = 'LanYang'
    AND pid = (SELECT id FROM categories WHERE name = 'h5' AND pid IS NULL LIMIT 1)
);
