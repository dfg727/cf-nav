-- Insert 'worker' if not exists
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at)
SELECT 'worker', 0, 1, 1, 1, strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'worker');

-- Insert 'other' if not exists
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at)
SELECT 'other', 1, 1, 1, 1, strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'other');

-- Insert 'h5' if not exists
INSERT INTO categories (name, sort_order, is_public, is_expand, status, created_at)
SELECT 'h5', 2, 1, 1, 1, strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'h5');
