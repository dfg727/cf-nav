import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0),
    isPublic: integer('is_public', { mode: 'boolean' }).default(true),
    isExpand: integer('is_expand', { mode: 'boolean' }).default(false),
    status: integer('status').default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sites = sqliteTable('sites', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id').references(() => categories.id),
    name: text('name').notNull(),
    url: text('url').notNull(),
    innerUrl: text('inner_url'),
    description: text('description'),
    icon: text('icon'),
    tags: text('tags'), // Stored as JSON string or comma separated
    status: integer('status').default(1),
    isPublic: integer('is_public', { mode: 'boolean' }).default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()), // Start with createdAt, update manually or via app logic
});
