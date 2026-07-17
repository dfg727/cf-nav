const fs = require("node:fs");
const path = require("node:path");

const SITE_ID_OFFSET = 10000000;
const scriptsDir = __dirname;
const legacyDir = path.join(scriptsDir, "legacy");
const outputFile = path.join(scriptsDir, "01.migrated_legacy_data.sql");

const inputFiles = [
  path.join(legacyDir, "sqlite_index.sql"),
  path.join(legacyDir, "sqlite_other.sql")
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

    // 每行数据打上来源标记，用于后续把该文件下的顶级分类重新挂到对应的 index/other 根节点下
    const sourceCategory = path.basename(filePath).includes("sqlite_index") ? "index" : "other";

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 只处理 INSERT INTO site_item 语句
      if (!line || line.startsWith("--") || !line.toLowerCase().startsWith("insert into site_item")) {
        continue;
      }
      
      totalRawInserts++;
      
      // 正则解析 INSERT 语句的列和值
      const match = line.match(/insert into site_item\s*\(([^)]+)\)\s*values\s*\((.+)\);/i);
      if (!match) {
        console.error(`Line ${i + 1} failed to match INSERT regex in file ${path.basename(filePath)}`);
        process.exit(1);
      }
      
      const columns = match[1].split(",").map(c => c.trim().toLowerCase());
      const rawValues = parseSqlValues(match[2]);
      
      if (columns.length !== rawValues.length) {
        console.error(`Column count mismatch at line ${i + 1}: cols=${columns.length}, vals=${rawValues.length}`);
        process.exit(1);
      }
      
      // 组装成对象，字段值保持 SQL 原始字面量（比如 'Common Sites'、NULL、1000 等）
      const row = { sourceCategory };
      columns.forEach((col, idx) => {
        row[col] = rawValues[idx];
      });

      allRows.push(row);
    }
  }
  
  console.log(`Successfully parsed ${totalRawInserts} insert statements.`);
  
  // 步骤 2：数据清洗与分类/站点判定
  const skippedRows = [];
  const categoryRows = [];
  const siteRows = [];
  
  const categoryIds = new Set();
  
  for (const row of allRows) {
    const rawId = parseInt(row.id);
    const rawPid = parseInt(row.pid);
    
    // 过滤死链行（脏数据）
    if (isDeadLinkRow(row.name, row.uri)) {
      skippedRows.push(row);
      continue;
    }
    
    // 分类判定：uri 为 NULL
    if (row.uri.toUpperCase() === 'NULL') {
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
  
  // 步骤 3：数据完整性校验 (对账与拓扑检查)
  console.log("Running integrity constraints validation...");
  
  // 校验 1：站点引用的 category_id 必须存在于分类表中
  for (const site of siteRows) {
    const rawPid = parseInt(site.pid);
    if (!categoryIds.has(rawPid)) {
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
  const checkCount = categoryRows.length + siteRows.length + skippedRows.length;
  if (checkCount !== totalRawInserts) {
    throw new Error(`[Integrity Check Failed] Total row count check failed: categories(${categoryRows.length}) + sites(${siteRows.length}) + skipped(${skippedRows.length}) = ${checkCount}, expected ${totalRawInserts}`);
  }
  console.log(`  ✔ Constraint 4 check passed: Row count reconciled successfully (${checkCount} rows).`);

  // 步骤 4：生成标准的双表 SQL 脚本
  const sqlStatements = [];
  
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("-- Auto-generated data migration from legacy python sitenav");
  sqlStatements.push(`-- Generated At: ${new Date().toISOString()}`);
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
  sqlStatements.push("-- index/other root created in PHASE 0 instead of staying pid = NULL.");
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("");

  for (const cat of categoryRows) {
    const rawId = parseInt(cat.id);
    const rawPid = parseInt(cat.pid);
    const pidVal = rawPid === 0
      ? `(SELECT id FROM categories WHERE name = '${cat.sourceCategory}' AND pid IS NULL LIMIT 1)`
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
  sqlStatements.push("-- ========================================================");
  sqlStatements.push("");
  
  for (const site of siteRows) {
    const rawId = parseInt(site.id);
    const targetId = rawId + SITE_ID_OFFSET;
    const rawPid = parseInt(site.pid); // 站点的 pid 即对应的 category_id
    
    // sites 字段：id, category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at
    // python 中没有 inner_url/tags，在此留为 NULL/默认
    const descriptionVal = site.desc || "NULL";
    const faviconVal = site.favicon || "NULL";
    
    sqlStatements.push(
      `INSERT INTO sites (id, category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at) ` +
      `VALUES (${targetId}, ${rawPid}, ${site.name}, ${site.uri}, ${descriptionVal}, ${faviconVal}, ${site.status}, ${site.status}, ${site.ordernum}, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);`
    );
  }
  
  sqlStatements.push("");
  sqlStatements.push("-- Migration SQL script generation completed.");
  
  fs.writeFileSync(outputFile, sqlStatements.join("\n"), "utf-8");
  console.log(`\n✔ Migration SQL file generated successfully: ${outputFile}`);
  console.log(`Run this file using wrangler to seed local/prod databases.`);
}

runMigration();
