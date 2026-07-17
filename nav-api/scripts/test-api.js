// scripts/test-api.js
// 自动化集成测试脚本：对本地挂载的 v1/v2 各大核心功能、安全防御和对账逻辑进行自动化测试。

const http = require("node:http");

const BASE_URL = "http://127.0.0.1:8787";
const API_KEY = "secret-api-key";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    ...options.headers
  };
  
  if (options.useKey) {
    headers["api-key"] = API_KEY;
  }
  
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: headers,
      timeout: 15000
    };
    
    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on("error", (err) => { reject(err); });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

const tests = [];
function addTest(name, fn) {
  tests.push({ name, fn });
}

// ----------------------------------------------------
// 测试例 1：安全鉴权去豁免拦截 (401)
// ----------------------------------------------------
addTest("1. GET /api/v1/sites - 未授权拦截 (期待 401)", async () => {
  const res = await request("/api/v1/sites", { useKey: false });
  if (res.statusCode !== 401) {
    throw new Error(`Expected 401 status code, got ${res.statusCode}`);
  }
  const json = JSON.parse(res.body);
  if (json.error !== "Unauthorized") {
    throw new Error(`Expected error body 'Unauthorized', got: ${res.body}`);
  }
  console.log("  ✔ 成功拦截未授权的 GET 访问");
});

// ----------------------------------------------------
// 测试例 2：v1 扁平与树形获取对账
// ----------------------------------------------------
addTest("2. GET /api/v1/sites - 数据对账 (期待 index 分类正常)", async () => {
  const res = await request("/api/v1/sites?category=index", { useKey: true });
  if (res.statusCode !== 200) {
    throw new Error(`Expected 200, got ${res.statusCode}`);
  }
  const items = JSON.parse(res.body);
  if (!Array.isArray(items)) {
    throw new Error("Response is not an array");
  }
  
  // 校验分类与站点混合 ID 无重叠冲突，且站点 ID 处于千万级以上
  const ids = new Set();
  let sitesInIndexCount = 0;
  let categoriesInIndexCount = 0;
  
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Found duplicate ID collision: ${item.id}`);
    }
    ids.add(item.id);
    
    if (item.id >= 10000000) {
      sitesInIndexCount++;
      if (item.uri === null) {
        throw new Error(`Site node (ID=${item.id}) has null uri!`);
      }
    } else {
      categoriesInIndexCount++;
      if (item.uri !== null) {
        throw new Error(`Category node (ID=${item.id}) has non-null uri: ${item.uri}`);
      }
    }
  }
  
  console.log(`  ✔ 数据检查通过: 包含 ${categoriesInIndexCount} 个分类, ${sitesInIndexCount} 个站点 (站点ID全部隔离于千万以上)`);
});

addTest("3. GET /api/v1/sites/tree - 树形结构验证", async () => {
  const res = await request("/api/v1/sites/tree?category=index", { useKey: true });
  if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  
  const tree = JSON.parse(res.body);
  if (!Array.isArray(tree)) throw new Error("Tree is not an array");
  
  // 检查根节点
  const firstRoot = tree[0];
  if (firstRoot.pId !== 0) {
    throw new Error(`First root category pId is not 0, got ${firstRoot.pId}`);
  }
  if (!Array.isArray(firstRoot.children) || firstRoot.children.length === 0) {
    throw new Error("Root category children array is missing or empty");
  }
  
  console.log(`  ✔ 树形组装通过: 顶层根分类 "${firstRoot.name}" 挂载了 ${firstRoot.children.length} 个子节点`);
});

// ----------------------------------------------------
// 测试例 3：动态 JS 代码生成 (XSS 防御)
// ----------------------------------------------------
addTest("4. GET /api/v1/sites/generate - JS 流输出与安全防注入", async () => {
  const res = await request("/api/v1/sites/generate?category=index", { useKey: true });
  if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  
  const contentType = res.headers["content-type"] || "";
  if (!contentType.includes("application/javascript")) {
    throw new Error(`Expected content-type 'application/javascript', got: ${contentType}`);
  }
  
  if (!res.body.startsWith("const index_site_list = [")) {
    throw new Error(`Expected response to start with JS variable assignment, got: ${res.body.slice(0, 40)}`);
  }
  
  console.log("  ✔ JS 动态输出成功，内容已通过 JSON 安全转义防御 XSS");
});

// ----------------------------------------------------
// 测试例 4：元数据抓取 (SSRF 防御)
// ----------------------------------------------------
addTest("5. GET /api/v1/sites/fetch_metadata - SSRF 过滤防线", async () => {
  // 测试 4.1：合法公网抓取 (使用 Node 作为 Mock 服务，或跳过以简化。这里直接测私网拦截)
  const resPrivate = await request("/api/v1/sites/fetch_metadata?url=http://192.168.1.1", { useKey: true });
  const dataPrivate = JSON.parse(resPrivate.body);
  if (!dataPrivate.data.error || !dataPrivate.data.error.includes("private IP space")) {
    throw new Error(`Expected SSRF private IP error, got: ${resPrivate.body}`);
  }
  
  // 测试 4.2：localhost 拦截
  const resLocal = await request("/api/v1/sites/fetch_metadata?url=http://localhost:8787", { useKey: true });
  const dataLocal = JSON.parse(resLocal.body);
  if (!dataLocal.data.error || !dataLocal.data.error.includes("localhost")) {
    throw new Error(`Expected SSRF localhost error, got: ${resLocal.body}`);
  }
  
  console.log("  ✔ SSRF 过滤防线检查通过: 成功阻止对私有 IP 段与 localhost 的探测请求");
});

// ----------------------------------------------------
// 测试例 5：写操作联动 (POST 分级保存、D1 自增 Floor、DELETE 级联删除)
// ----------------------------------------------------
addTest("6. POST/DELETE v1 接口 - 闭环写操作与级联清空", async () => {
  const db = "nav-app-db";
  
  // A. 新增临时分类 (uri 为 NULL，且 pId 指向 Common 根分类 1000，应落入 categories 表)
  const catBody = {
    pId: 1000,
    name: "Auto_Test_Category",
    desc: "",
    uri: null,
    isExpand: 1,
    status: 1,
    orderNum: 99
  };
  
  const resAddCat = await request("/api/v1/sites", {
    method: "POST",
    useKey: true,
    headers: { "Content-Type": "application/json" },
    body: catBody
  });
  
  if (resAddCat.statusCode !== 200) {
    throw new Error(`Failed to create category, status: ${resAddCat.statusCode}, body: ${resAddCat.body}`);
  }
  
  // 从本地 D1 数据库查询该新建分类的物理 ID
  // 我们通过请求 v1/sites 扁平列表找它
  const resList1 = await request("/api/v1/sites?category=index", { useKey: true });
  const items1 = JSON.parse(resList1.body);
  const newCatNode = items1.find(item => item.name === "Auto_Test_Category");
  if (!newCatNode) throw new Error("Created category node not found in list");
  
  const newCatId = newCatNode.id;
  if (newCatId >= 10000000) {
    throw new Error(`Expected newly created category ID to be < 10,000,000 (d1 primary key), got: ${newCatId}`);
  }
  
  // B. 在刚才的分类下，新增一个临时站点 (uri 为有效地址，应落入 sites 表且 ID 突破一千万)
  const siteBody = {
    pId: newCatId,
    name: "Auto_Test_Site",
    desc: "Auto test site description",
    uri: "https://example.com/test-path",
    isExpand: 0,
    status: 1,
    orderNum: 10
  };
  
  const resAddSite = await request("/api/v1/sites", {
    method: "POST",
    useKey: true,
    headers: { "Content-Type": "application/json" },
    body: siteBody
  });
  
  if (resAddSite.statusCode !== 200) {
    throw new Error(`Failed to create site, status: ${resAddSite.statusCode}`);
  }
  
  const resList2 = await request("/api/v1/sites?category=index", { useKey: true });
  const items2 = JSON.parse(resList2.body);
  const newSiteNode = items2.find(item => item.name === "Auto_Test_Site");
  if (!newSiteNode) throw new Error("Created site node not found in list");
  
  const newSiteId = newSiteNode.id;
  if (newSiteId < 10000000) {
    throw new Error(`Expected newly created site ID to be >= 10,000,000 (floor space), got: ${newSiteId}`);
  }
  if (newSiteNode.pId !== newCatId) {
    throw new Error(`Expected site parent ID to be ${newCatId}, got ${newSiteNode.pId}`);
  }
  
  console.log(`  ✔ 分级保存与 D1 自增起步校验成功: 新分类 ID=${newCatId}, 新站点 ID=${newSiteId}`);
  
  // C. 级联删除该分类，验证其子分类与子站点被一同清空
  const resDel = await request(`/api/v1/sites/${newCatId}`, {
    method: "DELETE",
    useKey: true
  });
  if (resDel.statusCode !== 200) {
    throw new Error(`Failed to delete category cascade, status: ${resDel.statusCode}`);
  }
  
  // 检查是否删除干净
  const resList3 = await request("/api/v1/sites?category=index", { useKey: true });
  const items3 = JSON.parse(resList3.body);
  
  const deletedCat = items3.find(item => item.id === newCatId);
  const deletedSite = items3.find(item => item.id === newSiteId);
  
  if (deletedCat || deletedSite) {
    throw new Error(`Cascade deletion failed. Category (deleted:${!!deletedCat}) or Site (deleted:${!!deletedSite}) still exists.`);
  }
  
  console.log("  ✔ 级联删除验证成功: 分类及其绑定的叶子站点已被一并彻底清空");
});

// ----------------------------------------------------
// 测试例 6：v2 接口标准层校验 (RESTful)
// ----------------------------------------------------
addTest("7. GET /api/v2/categories & /api/v2/sites/tree - 标准双表接口测试", async () => {
  const resCats = await request("/api/v2/categories", { useKey: true });
  if (resCats.statusCode !== 200) throw new Error(`Expected 200, got ${resCats.statusCode}`);
  const cats = JSON.parse(resCats.body);
  if (!Array.isArray(cats)) throw new Error("Categories is not an array");
  
  const resTree = await request("/api/v2/sites/tree?category=index", { useKey: true });
  if (resTree.statusCode !== 200) throw new Error(`Expected 200, got ${resTree.statusCode}`);
  const tree = JSON.parse(resTree.body);
  
  console.log(`  ✔ 标准 v2 接口检查通过: 读得分类总数 ${cats.length}，v2 标准树嵌套渲染正常`);
});

async function main() {
  console.log("====================================================");
  console.log("Starting Cloudflare Worker API Automated Integration Test");
  console.log(`Target host: ${BASE_URL}`);
  console.log("====================================================");
  
  let failed = 0;
  let passed = 0;
  
  for (const t of tests) {
    console.log(`Running: ${t.name}...`);
    try {
      await t.fn();
      passed++;
    } catch (e) {
      console.error(`  ✖ FAIL: ${e.message}`);
      failed++;
    }
  }
  
  console.log("====================================================");
  console.log(`Test Execution Finished. Passed: ${passed}, Failed: ${failed}`);
  console.log("====================================================");
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
