const fs = require("node:fs");
const path = require("node:path");

const SITE_ID_OFFSET = 10000000;
const scriptsDir = __dirname;
const legacyDir = path.join(scriptsDir, "legacy");
const outputFile = path.join(scriptsDir, "01.migrated_legacy_data.sql");

// site_item.sql 是 index/other/h5 三个分类桶的统一单表导出（取代原先分开的
// sqlite_index.sql / sqlite_other.sql，且 h5 部分的数据比旧版 02/03 种子脚本更完整），
// 现在唯一的数据源，一次生成出唯一需要运行的迁移脚本。
const inputFiles = [
  path.join(legacyDir, "site_item.sql"),
];

// Tokenizer分割VALUES括号中的字面量，正确处理单引号字符串（支持字面量内含逗号与转义字符）
function parseSqlValues(valuesStr) {
  const values = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    // 处理 SQLite 转义单引号：在 SQLite 中，单引号是通过两个连续单引号 '' 来转义的
    if (char === "'") {
      // 检查是否是连续两个单引号
      if (inQuote && valuesStr[i + 1] === "'") {
        current += "''";
        i++; // 跳过下一个单引号
        continue;
      }
      inQuote = !inQuote;
      current += char;
    } else if (char === ',' && !inQuote) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// 辅助函数：从单引号包裹的字符串中还原出真实文本内容（用于脏数据过滤和合法性判定）
// 返回 null 表示 SQL NULL；返回 '' 表示显式的空字符串占位（site_item.sql 里 h5 分类行
// 用 '' 而不是 NULL 来表示"这是一个分类"，和 index/other 的写法不一致，两种都要认）。
function cleanStringValue(val) {
  if (!val || val.toUpperCase() === 'NULL') return null;
  if (val.startsWith("'") && val.endsWith("'")) {
    let content = val.slice(1, -1);
    // 将 SQLite 转义的双单引号 '' 还原为单个单引号 '
    return content.replace(/''/g, "'");
  }
  return val;
}

const JUNK_URIs = new Set(['javascript:void(0);', 'javascript:;', '#']);

function isDeadLinkRow(name, uri) {
  const cleanedName = cleanStringValue(name);
  const cleanedUri = cleanStringValue(uri);
  return cleanedUri != null && JUNK_URIs.has(cleanedUri.trim()) && (!cleanedName || cleanedName.trim() === '');
}

// 把整份文件按"语句"而不是按"行"切分：site_item.sql 里至少有一行 desc 字段
// 内嵌了原始换行符（多行文本），单纯按行处理会把一条 INSERT 语句截断。
// 用引号奇偶性 + 是否以 ; 收尾来判断一条语句有没有读完。
function splitStatements(content) {
  const rawLines = content.split(/\r?\n/);
  const statements = [];
  let buffer = '';
  let inQuote = false;

  for (const rawLine of rawLines) {
    if (buffer === '' && (!rawLine.trim() || rawLine.trim().startsWith('--'))) continue;
    buffer += (buffer ? '\n' : '') + rawLine;

    for (let i = 0; i < rawLine.length; i++) {
      if (rawLine[i] === "'") {
        if (inQuote && rawLine[i + 1] === "'") { i++; continue; }
        inQuote = !inQuote;
      }
    }

    if (!inQuote && buffer.trim().endsWith(';')) {
      statements.push(buffer);
      buffer = '';
    }
  }
  return statements;
}

function runMigration() {
  console.log("Starting legacy SQL data migration generation...");

  const allRows = [];
  let totalRawInserts = 0;

  // 步骤 1：解析所有输入的原始 SQL 文件
  for (const filePath of inputFiles) {
    if (!fs.existsSync(filePath)) {
      console.error(`Input file not found: ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const statements = splitStatements(content);

    for (const stmt of statements) {
      // 兼容表名/列名两侧可能带双引号的写法（"site_item"、"id" 等）
      if (!/^insert into "?site_item"?\s*\(/i.test(stmt.trim())) continue;

      totalRawInserts++;

      const match = stmt.match(/insert into "?site_item"?\s*\(([^)]+)\)\s*values\s*\(([\s\S]+)\);\s*$/i);
      if (!match) {
        console.error(`Failed to match INSERT regex for statement:\n${stmt}`);
        process.exit(1);
      }

      const columns = match[1].split(",").map(c => c.trim().replace(/"/g, '').toLowerCase());
      const rawValues = parseSqlValues(match[2]);

      if (columns.length !== rawValues.length) {
        console.error(`Column count mismatch: cols=${columns.length}, vals=${rawValues.length}\n${stmt}`);
        process.exit(1);
      }

      // 组装成对象，字段值保持 SQL 原始字面量（比如 'Common Sites'、NULL、1000 等）
      const row = {};
      columns.forEach((col, idx) => {
        row[col] = rawValues[idx];
      });

      allRows.push(row);
    }
  }

  console.log(`Successfully parsed ${totalRawInserts} insert statements.`);

  // 步骤 2：数据清洗、去重与分类/站点判定
  const skippedRows = [];
  const duplicateRows = [];
  const categoryRows = [];
  const siteRows = [];

  const categoryIds = new Set();
  const seenSignatures = new Map(); // 签名(不含 id) -> 首次出现的原始 id，用于识别完全重复的行

  for (const row of allRows) {
    const rawId = parseInt(row.id);
    const rawPid = parseInt(row.pid);

    // 过滤死链行（脏数据）
    if (isDeadLinkRow(row.name, row.uri)) {
      skippedRows.push(row);
      continue;
    }

    // 完全重复行去重：字段（除 id 外）完全一致就只保留第一条
    const signature = ['pid', 'name', 'desc', 'uri', 'isexpand', 'favicon', 'status', 'category', 'ordernum']
      .map(k => row[k]).join('|||');
    if (seenSignatures.has(signature)) {
      duplicateRows.push({ ...row, keptAsId: seenSignatures.get(signature) });
      continue;
    }
    seenSignatures.set(signature, row.id);

    // 分类判定：uri 为 NULL，或显式的空字符串占位（site_item.sql 里 h5 分类行用的是后者）
    const cleanedUri = cleanStringValue(row.uri);
    const isCategory = cleanedUri === null || cleanedUri === '';

    if (isCategory) {
      categoryRows.push(row);
      categoryIds.add(rawId);
    } else {
      siteRows.push(row);
    }
  }

  console.log(`Data Classification:`);
  console.log(`  - Categories found: ${categoryRows.length}`);
  console.log(`  - Sites found: ${siteRows.length}`);
  console.log(`  - Junk/Dead link rows skipped: ${skippedRows.length}`);
  skippedRows.forEach(r => {
    console.log(`    * Skipped Row: ID=${r.id}, Name=${r.name}, URI=${r.uri}`);
  });
  console.log(`  - Exact duplicate rows collapsed: ${duplicateRows.length}`);
  duplicateRows.forEach(r => {
    console.log(`    * Duplicate Row: ID=${r.id} is identical to ID=${r.keptAsId}, Name=${r.name} — dropped`);
  });

  // 步骤 3：数据完整性校验 (对账与拓扑检查)
  console.log("Running integrity constraints validation...");

  // 校验 1：站点引用的 category_id 必须存在于分类表中（顶级站点 pid=0 除外，PHASE 2 会把它解析成所属分类桶的根）
  for (const site of siteRows) {
    const rawPid = parseInt(site.pid);
    if (rawPid !== 0 && !categoryIds.has(rawPid)) {
      throw new Error(`[Integrity Check Failed] Site ID=${site.id} references non-existent category pId=${site.pid}`);
    }
  }
  console.log("  ✔ Constraint 1 check passed: No dangling category_id references in sites.");

  // 校验 2：子分类引用的 pid 必须存在于分类表中（除 0 外）
  for (const cat of categoryRows) {
    const rawPid = parseInt(cat.pid);
    if (rawPid !== 0 && !categoryIds.has(rawPid)) {
      throw new Error(`[Integrity Check Failed] Category ID=${cat.id} references non-existent parent pId=${cat.pid}`);
    }
  }
  console.log("  ✔ Constraint 2 check passed: No dangling pid parent references in categories.");

  // 校验 3：检查分类层级闭环路 (自引用或循环引用)
  const adjMap = new Map();
  categoryRows.forEach(cat => {
    const rawId = parseInt(cat.id);
    const rawPid = parseInt(cat.pid);
    if (rawPid !== 0) {
      adjMap.set(rawId, rawPid);
    }
  });

  for (const [startId, _] of adjMap) {
    let current = startId;
    const visited = new Set([current]);
    while (adjMap.has(current)) {
      current = adjMap.get(current);
      if (visited.has(current)) {
        throw new Error(`[Integrity Check Failed] Loop detected in categories parent hierarchy starting from ID=${startId}! Loop path: ${Array.from(visited).join(" -> ")} -> ${current}`);
      }
      visited.add(current);
    }
  }
  console.log("  ✔ Constraint 3 check passed: No loop or self-reference detected in categories hierarchy.");

  // 校验 4：总行数对账
  const checkCount = categoryRows.length + siteRows.length + skippedRows.length + duplicateRows.length;
  if (checkCount !== totalRawInserts) {
    throw new Error(`[Integrity Check Failed] Total row count check failed: categories(${categoryRows.length}) + sites(${siteRows.length}) + skipped(${skippedRows.length}) + duplicates(${duplicateRows.length}) = ${checkCount}, expected ${totalRawInserts}`);
  }
  console.log(`  ✔ Constraint 4 check passed: Row count reconciled successfully (${checkCount} rows).`);

  // 步骤 4：生成标准的双表 SQL 脚本
  const sqlStatements = [];

  sqlStatements.push("-- ========================================================");
  sqlStatements.push("-- Auto-generated data migration from legacy python sitenav (single source: scripts/legacy/site_item.sql)");
  sqlStatements.push(`-- Generated At: ${new Date().toISOString()}`);
  sqlStatements.push("-- This is the ONLY script that needs to be run to fully sync local/prod data.");
  sqlStatements.push("-- Do not hand-edit — regenerate via `npm run db:migrate-legacy:generate`.");
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("");
  sqlStatements.push("-- Clean legacy table data for idempotency");
  sqlStatements.push("DELETE FROM sites;");
  sqlStatements.push("DELETE FROM categories;");
  sqlStatements.push("");
  sqlStatements.push("-- Seed D1 AUTOINCREMENT floor for sites table (10,000,000)");
  sqlStatements.push("INSERT INTO sites (id, category_id, name, url, status) VALUES (9999999, NULL, '__seed_floor__', 'about:blank', 0);");
  sqlStatements.push("DELETE FROM sites WHERE id = 9999999;");
  sqlStatements.push("");

  sqlStatements.push("-- ========================================================");
  sqlStatements.push("-- PHASE 0: Create the index/other/h5 root buckets");
  sqlStatements.push("-- These are real category rows (pid IS NULL) that the v1 adapter layer");
  sqlStatements.push("-- reads back via name, replacing the old rootId>=2000 ID-threshold guess.");
  sqlStatements.push("-- No explicit id: on a freshly emptied table these autoincrement to 1/2/3,");
  sqlStatements.push("-- which never collides with the preserved legacy ids (1000+/2000+) below.");
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("");
  sqlStatements.push("INSERT INTO categories (pid, name, sort_order, is_public, is_expand, status, created_at) VALUES (NULL, 'index', 0, 1, 1, 1, strftime('%s', 'now') * 1000);");
  sqlStatements.push("INSERT INTO categories (pid, name, sort_order, is_public, is_expand, status, created_at) VALUES (NULL, 'other', 1, 1, 1, 1, strftime('%s', 'now') * 1000);");
  sqlStatements.push("INSERT INTO categories (pid, name, sort_order, is_public, is_expand, status, created_at) VALUES (NULL, 'h5', 2, 1, 1, 1, strftime('%s', 'now') * 1000);");
  sqlStatements.push("");

  sqlStatements.push("-- ========================================================");
  sqlStatements.push("-- PHASE 1: Populate categories (preserving original raw IDs)");
  sqlStatements.push("-- Top-level rows (original pId = 0) are reparented under the matching");
  sqlStatements.push("-- index/other/h5 root created in PHASE 0 instead of staying pid = NULL.");
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("");

  for (const cat of categoryRows) {
    const rawId = parseInt(cat.id);
    const rawPid = parseInt(cat.pid);
    const bucket = cleanStringValue(cat.category);
    const pidVal = rawPid === 0
      ? `(SELECT id FROM categories WHERE name = '${bucket}' AND pid IS NULL LIMIT 1)`
      : rawPid;

    // categories 字段：id, pid, name, sort_order, is_public, is_expand, status, created_at
    sqlStatements.push(
      `INSERT INTO categories (id, pid, name, sort_order, is_public, is_expand, status, created_at) ` +
      `VALUES (${rawId}, ${pidVal}, ${cat.name}, ${cat.ordernum}, ${cat.status}, ${cat.isexpand}, ${cat.status}, strftime('%s', 'now') * 1000);`
    );
  }

  sqlStatements.push("");
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("-- PHASE 2: Populate sites (applying SITE_ID_OFFSET = 10000000)");
  sqlStatements.push("-- Top-level sites (original pId = 0) are reparented under the matching");
  sqlStatements.push("-- index/other/h5 root the same way top-level categories are in PHASE 1 —");
  sqlStatements.push("-- category_id = 0 doesn't reference any real category.");
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("");

  for (const site of siteRows) {
    const rawId = parseInt(site.id);
    const targetId = rawId + SITE_ID_OFFSET;
    const rawPid = parseInt(site.pid); // 站点的 pid 即对应的 category_id
    const bucket = cleanStringValue(site.category);
    const categoryIdVal = rawPid === 0
      ? `(SELECT id FROM categories WHERE name = '${bucket}' AND pid IS NULL LIMIT 1)`
      : rawPid;

    // sites 字段：id, category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at
    // python 中没有 inner_url/tags，在此留为 NULL/默认
    const descriptionVal = site.desc || "NULL";
    const faviconVal = site.favicon || "NULL";

    sqlStatements.push(
      `INSERT INTO sites (id, category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at) ` +
      `VALUES (${targetId}, ${categoryIdVal}, ${site.name}, ${site.uri}, ${descriptionVal}, ${faviconVal}, ${site.status}, ${site.status}, ${site.ordernum}, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);`
    );
  }

  sqlStatements.push("");
  sqlStatements.push("-- Migration SQL script generation completed.");

  fs.writeFileSync(outputFile, sqlStatements.join("\n"), "utf-8");
  console.log(`\n✔ Migration SQL file generated successfully: ${outputFile}`);
  console.log(`Run this file using wrangler to seed local/prod databases.`);
}

runMigration();
