import { SitesApi, CategoriesApi } from './api.js';
import { openModal, closeModal, confirmDialog, toast, escapeHtml } from './ui.js';
import { STATUS_OPTIONS, statusMeta } from './constants.js';

let root = null;
let bucketTabsEl = null;
let filterEl = null;
let tableEl = null;
let sitesAll = [];
let categoriesFlat = [];
let buckets = []; // root (pid == null) categories — index / other / h5
let activeBucketId = null;
let categoryFilter = ''; // '' = whole bucket

export async function initSites(el) {
  root = el;
  root.innerHTML = `
    <div class="card p-3 sm:p-4">
      <div class="mb-4 space-y-2">
        <div id="bucket-tabs" class="flex gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-full"></div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <select id="site-category-filter" class="input sm:!w-56"></select>
          <div class="flex items-center gap-2 sm:ml-auto">
            <button type="button" id="site-refresh" class="btn-secondary">刷新</button>
            <button type="button" id="site-new" class="btn-primary">新建站点</button>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="block sm:table w-full sm:table-fixed text-sm">
          <thead class="hidden sm:table-header-group">
            <tr class="text-left text-xs uppercase text-slate-400 border-b border-slate-200">
              <th class="py-2 pr-3 w-[26%]">站点</th>
              <th class="py-2 pr-3 w-[13%]">分类</th>
              <th class="py-2 pr-3 w-[20%]">链接</th>
              <th class="py-2 pr-3 w-[12%]">标签</th>
              <th class="py-2 pr-3 w-[8%]">状态</th>
              <th class="py-2 pr-3 w-[7%]">排序</th>
              <th class="py-2 pr-3 text-right w-[14%]">操作</th>
            </tr>
          </thead>
          <tbody id="site-table-body" class="block sm:table-row-group"></tbody>
        </table>
      </div>
    </div>
  `;
  bucketTabsEl = root.querySelector('#bucket-tabs');
  filterEl = root.querySelector('#site-category-filter');
  tableEl = root.querySelector('#site-table-body');

  root.querySelector('#site-refresh').addEventListener('click', reload);
  root.querySelector('#site-new').addEventListener('click', () => openSiteForm(null));
  filterEl.addEventListener('change', () => {
    categoryFilter = filterEl.value;
    renderTable();
  });
  tableEl.addEventListener('click', onTableClick);

  await reload();
}

async function reload() {
  tableEl.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">加载中...</td></tr>`;
  try {
    [categoriesFlat, sitesAll] = await Promise.all([CategoriesApi.list(), SitesApi.list()]);
    buckets = categoriesFlat.filter((c) => c.pid == null).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (activeBucketId == null || !buckets.some((b) => b.id === activeBucketId)) {
      activeBucketId = buckets[0]?.id ?? null;
    }
    categoryFilter = '';
    renderBucketTabs();
    renderFilterOptions();
    renderTable();
  } catch (err) {
    tableEl.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-500">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderBucketTabs() {
  bucketTabsEl.innerHTML = buckets
    .map((b) => `<button type="button" data-bucket="${b.id}" class="tab-btn shrink-0 ${b.id === activeBucketId ? 'active' : ''}">${escapeHtml(b.name)}</button>`)
    .join('');
  bucketTabsEl.querySelectorAll('[data-bucket]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBucketId = Number(btn.dataset.bucket);
      categoryFilter = '';
      renderBucketTabs();
      renderFilterOptions();
      renderTable();
    });
  });
}

function getDescendantIds(id) {
  const ids = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const cat of categoriesFlat) {
      if (cat.pid != null && ids.has(cat.pid) && !ids.has(cat.id)) {
        ids.add(cat.id);
        added = true;
      }
    }
  }
  return ids;
}

function categoryOptionsHtml(bucketRootId, selectedId) {
  const bucketRoot = categoriesFlat.find((c) => c.id === bucketRootId);
  const options = [];
  if (bucketRoot) {
    options.push(`<option value="${bucketRoot.id}" ${bucketRoot.id === selectedId ? 'selected' : ''}>${escapeHtml(bucketRoot.name)}（根目录）</option>`);
  }
  const walk = (pid, depth) => {
    const children = categoriesFlat.filter((c) => c.pid === pid);
    for (const c of children) {
      const prefix = '　'.repeat(depth);
      options.push(`<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${prefix}${escapeHtml(c.name)}</option>`);
      walk(c.id, depth + 1);
    }
  };
  walk(bucketRootId, 1);
  return options.join('');
}

function renderFilterOptions() {
  if (activeBucketId == null) {
    filterEl.innerHTML = '';
    return;
  }
  const bucket = categoriesFlat.find((c) => c.id === activeBucketId);
  filterEl.innerHTML = `<option value="">全部（${escapeHtml(bucket?.name ?? '')} 目录下所有站点）</option>${categoryOptionsHtml(activeBucketId, null)}`;
  filterEl.value = categoryFilter;
}

function categoryName(id) {
  if (id == null) return '未分类';
  return categoriesFlat.find((c) => c.id === id)?.name ?? `#${id}`;
}

function getVisibleSites() {
  if (activeBucketId == null) return [];
  const bucketIds = getDescendantIds(activeBucketId);
  const filtered = sitesAll.filter((site) => {
    if (site.categoryId == null || !bucketIds.has(site.categoryId)) return false;
    if (categoryFilter && site.categoryId !== Number(categoryFilter)) return false;
    return true;
  });
  return filtered.sort((a, b) => (a.categoryId ?? -1) - (b.categoryId ?? -1) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
}

function siblingsOf(categoryId) {
  return sitesAll
    .filter((s) => s.categoryId === categoryId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
}

function renderTable() {
  const visible = getVisibleSites();
  if (visible.length === 0) {
    tableEl.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">暂无站点</td></tr>`;
    return;
  }
  if (categoryFilter) {
    tableEl.innerHTML = visible.map((site) => renderRow(site, siblingsOf(site.categoryId))).join('');
    return;
  }
  // 未按分类筛选时按分类分组展示，让相邻行真正是同一分类下的兄弟站点，排序上/下移才有意义。
  let html = '';
  let lastCategoryId;
  let isFirstGroup = true;
  for (const site of visible) {
    if (site.categoryId !== lastCategoryId) {
      lastCategoryId = site.categoryId;
      html += `
        <tr class="block sm:table-row">
          <td colspan="7" class="block sm:table-cell ${isFirstGroup ? '' : 'pt-4 sm:pt-4'} pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">${escapeHtml(categoryName(site.categoryId))}</td>
        </tr>
      `;
      isFirstGroup = false;
    }
    html += renderRow(site, siblingsOf(site.categoryId));
  }
  tableEl.innerHTML = html;
}

function renderRow(site, siblings) {
  const status = statusMeta(site.status);
  const tags = (site.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const idx = siblings.findIndex((s) => s.id === site.id);
  const isFirst = idx <= 0;
  const isLast = idx === -1 || idx === siblings.length - 1;
  return `
    <tr class="block sm:table-row mb-3 sm:mb-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200 sm:border-b sm:border-slate-100 p-3 sm:p-0 hover:bg-slate-50">
      <td class="block sm:table-cell py-0 sm:py-2 pr-3 mb-2 sm:mb-0 sm:overflow-hidden">
        <div class="flex items-center gap-2 min-w-0">
          ${site.icon
            ? `<img src="${escapeHtml(site.icon)}" alt="" class="h-5 w-5 rounded shrink-0" onerror="this.style.visibility='hidden'" />`
            : `<span class="h-5 w-5 rounded bg-slate-200 shrink-0"></span>`}
          <div class="min-w-0 flex-1">
            <div class="font-medium text-slate-800 truncate">${escapeHtml(site.name)}</div>
            <div class="text-xs text-slate-400">#${site.id}${site.isPublic ? '' : ' · 私有'}</div>
          </div>
        </div>
      </td>
      <td class="flex sm:table-cell justify-between sm:justify-start items-center py-1 sm:py-2 pr-3 text-slate-600 border-t sm:border-t-0 border-slate-100 sm:overflow-hidden before:content-[attr(data-label)] before:text-xs before:font-semibold before:text-slate-400 before:shrink-0 before:mr-2 sm:before:content-none sm:before:mr-0" data-label="分类"><span class="min-w-0 flex-1 truncate text-right sm:text-left">${escapeHtml(categoryName(site.categoryId))}</span></td>
      <td class="flex sm:table-cell justify-between sm:justify-start items-center gap-2 py-1 sm:py-2 pr-3 sm:overflow-hidden before:content-[attr(data-label)] before:text-xs before:font-semibold before:text-slate-400 before:shrink-0 sm:before:content-none" data-label="链接">
        <a href="${escapeHtml(site.url)}" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate text-right sm:text-left text-brand-600 hover:underline">${escapeHtml(site.url)}</a>
      </td>
      <td class="flex sm:table-cell justify-between sm:justify-start items-center py-1 sm:py-2 pr-3 sm:overflow-hidden before:content-[attr(data-label)] before:text-xs before:font-semibold before:text-slate-400 before:shrink-0 sm:before:content-none" data-label="标签">
        <span class="min-w-0 flex-1 flex flex-wrap justify-end sm:justify-start gap-1">${tags.map((t) => `<span class="badge bg-slate-100 text-slate-600 max-w-[7rem] truncate inline-block align-bottom">${escapeHtml(t)}</span>`).join('')}</span>
      </td>
      <td class="flex sm:table-cell justify-between sm:justify-start items-center py-1 sm:py-2 pr-3 before:content-[attr(data-label)] before:text-xs before:font-semibold before:text-slate-400 before:shrink-0 sm:before:content-none" data-label="状态"><span class="badge ${status.className}">${status.label}</span></td>
      <td class="flex sm:table-cell justify-between sm:justify-start items-center py-1 sm:py-2 pr-3 text-slate-500 before:content-[attr(data-label)] before:text-xs before:font-semibold before:text-slate-400 before:shrink-0 sm:before:content-none" data-label="排序">${site.sortOrder ?? 0}</td>
      <td class="flex sm:table-cell justify-end items-center gap-1 py-2 sm:py-2 pr-0 sm:pr-3 mt-1 sm:mt-0 pt-2 sm:pt-2 border-t sm:border-t-0 border-slate-100 text-right whitespace-nowrap">
        ${!isFirst
          ? `<button type="button" data-move-up="${site.id}" class="btn-icon" title="上移">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 -rotate-90"><path fill-rule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06L10.19 9 6.22 5.28a.75.75 0 010-1.06z" clip-rule="evenodd" /></svg>
            </button>`
          : ''}
        ${!isLast
          ? `<button type="button" data-move-down="${site.id}" class="btn-icon" title="下移">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 rotate-90"><path fill-rule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06L10.19 9 6.22 5.28a.75.75 0 010-1.06z" clip-rule="evenodd" /></svg>
            </button>`
          : ''}
        <button type="button" data-edit="${site.id}" class="btn-icon" title="编辑">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
        </button>
        <button type="button" data-delete="${site.id}" class="btn-icon hover:!text-red-600" title="删除">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zm-3.877 9.415a.75.75 0 10-1.493.17l.5 4.5a.75.75 0 101.492-.17l-.5-4.5zm6.744 0a.75.75 0 00-1.494-.17l.5 4.5a.75.75 0 101.494.17l-.5-4.5z" clip-rule="evenodd" /></svg>
        </button>
      </td>
    </tr>
  `;
}

function onTableClick(e) {
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
  const moveUpId = e.target.closest('[data-move-up]')?.dataset.moveUp;
  const moveDownId = e.target.closest('[data-move-down]')?.dataset.moveDown;
  if (editId) {
    const site = sitesAll.find((s) => s.id === Number(editId));
    openSiteForm(site);
  } else if (deleteId) {
    handleDelete(Number(deleteId));
  } else if (moveUpId) {
    handleMove(Number(moveUpId), 'up');
  } else if (moveDownId) {
    handleMove(Number(moveDownId), 'down');
  }
}

async function handleMove(id, direction) {
  const site = sitesAll.find((s) => s.id === id);
  if (!site) return;
  const siblings = siblingsOf(site.categoryId);
  const idx = siblings.findIndex((s) => s.id === id);
  const swapWith = direction === 'up' ? siblings[idx - 1] : siblings[idx + 1];
  if (!swapWith) return;
  try {
    await Promise.all([
      SitesApi.update(site.id, { sortOrder: swapWith.sortOrder }),
      SitesApi.update(swapWith.id, { sortOrder: site.sortOrder }),
    ]);
    sitesAll = await SitesApi.list();
    renderTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openSiteForm(site) {
  const isEdit = Boolean(site);
  const defaultCategoryId = site?.categoryId ?? (categoryFilter ? Number(categoryFilter) : activeBucketId);
  openModal({
    title: isEdit ? `编辑站点 #${site.id}` : '新建站点',
    size: 'lg',
    bodyHtml: `
      <form id="site-form" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">名称</label>
            <input class="input" name="name" value="${escapeHtml(site?.name ?? '')}" placeholder="留空可自动抓取网页标题" />
          </div>
          <div>
            <label class="label">分类</label>
            <select class="input" name="categoryId">${categoryOptionsHtml(activeBucketId, defaultCategoryId)}</select>
          </div>
        </div>
        <div>
          <label class="label">URL</label>
          <input class="input" name="url" type="text" required value="${escapeHtml(site?.url ?? '')}" placeholder="https://example.com" />
        </div>
        <div>
          <label class="label">内网/备用地址（可选）</label>
          <input class="input" name="innerUrl" value="${escapeHtml(site?.innerUrl ?? '')}" />
        </div>
        <div>
          <label class="label">描述（可选，留空可自动抓取）</label>
          <textarea class="input" name="description" rows="2">${escapeHtml(site?.description ?? '')}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">图标 URL（可选，留空可自动抓取）</label>
            <input class="input" name="icon" value="${escapeHtml(site?.icon ?? '')}" />
          </div>
          <div>
            <label class="label">标签（逗号分隔，可选）</label>
            <input class="input" name="tags" value="${escapeHtml(site?.tags ?? '')}" placeholder="工具,常用" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="label">排序值</label>
            <input class="input" type="number" name="sortOrder" value="${site?.sortOrder ?? 0}" />
          </div>
          <div>
            <label class="label">状态</label>
            <select class="input" name="status">
              ${STATUS_OPTIONS.map((s) => `<option value="${s.value}" ${Number(site?.status ?? 1) === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end pb-1.5">
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isPublic" ${site?.isPublic ?? true ? 'checked' : ''} /> 公开可见
            </label>
          </div>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn-secondary" data-modal-close>取消</button>
      <button type="submit" form="site-form" class="btn-primary">保存</button>
    `,
    onMount: (modalRoot) => {
      modalRoot.querySelector('#site-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          name: String(fd.get('name') || '').trim(),
          categoryId: fd.get('categoryId') ? Number(fd.get('categoryId')) : null,
          url: String(fd.get('url') || '').trim(),
          innerUrl: String(fd.get('innerUrl') || '').trim() || null,
          description: String(fd.get('description') || '').trim() || null,
          icon: String(fd.get('icon') || '').trim() || null,
          tags: String(fd.get('tags') || '').trim() || null,
          sortOrder: Number(fd.get('sortOrder') || 0),
          status: Number(fd.get('status')),
          isPublic: fd.get('isPublic') === 'on',
        };
        try {
          if (isEdit) await SitesApi.update(site.id, payload);
          else await SitesApi.create(payload);
          closeModal();
          toast(isEdit ? '站点已更新' : '站点已创建', 'success');
          sitesAll = await SitesApi.list();
          renderTable();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

async function handleDelete(id) {
  const site = sitesAll.find((s) => s.id === id);
  const ok = await confirmDialog(`确定要删除站点「${site?.name ?? id}」吗？此操作不可撤销。`, { danger: true, confirmText: '删除' });
  if (!ok) return;
  try {
    await SitesApi.remove(id);
    toast('站点已删除', 'success');
    sitesAll = await SitesApi.list();
    renderTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}
