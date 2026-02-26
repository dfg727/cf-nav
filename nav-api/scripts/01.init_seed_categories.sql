-- Insert 'worker' if not exists (top-level, pid is NULL)
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT 'worker', 0, 1, 1, 1, strftime('%s', 'now') * 1000, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'worker');

-- Insert 'other' if not exists (top-level, pid is NULL)
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT 'other', 1, 1, 1, 1, strftime('%s', 'now') * 1000, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'other');

-- Insert 'h5' if not exists (top-level, pid is NULL)
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT 'h5', 2, 1, 1, 1, strftime('%s', 'now') * 1000, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'h5');

-- Insert h5 sub categories if not exists (children of h5)
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '常用',
  1,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '常用');

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '娱乐',
  2,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '娱乐');

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '工具',
  3,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '工具');

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '涨姿势',
  4,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '涨姿势');

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  '杂类',
  5,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = '杂类');

INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at, pid)
SELECT
  'LanYang',
  6,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  (SELECT id FROM categories WHERE name = 'h5' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'LanYang');
