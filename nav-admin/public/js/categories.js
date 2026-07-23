import { CategoriesApi } from './api.js';
import { openModal, closeModal, confirmDialog, toast, escapeHtml } from './ui.js';
import { STATUS_OPTIONS, statusMeta } from './constants.js';

let root = null;
let bucketTabsEl = null;
let treeEl = null;
let flatCategories = [];
let buckets = []; // root (pid == null) categories — index / other / h5
let activeBucketId = null;
const collapsed = new Set();

export async function initCategories(el) {
  root = el;
  root.innerHTML = `
    <div class="card p-3 sm:p-4">
      <div class="mb-4 space-y-2">
        <div id="bucket-tabs" class="flex gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-full"></div>
        <div class="flex items-center gap-2">
          <button type="button" id="category-refresh-btn" class="btn-secondary">刷新</button>
          <button type="button" id="new-category-btn" class="btn-primary ml-auto">新建分类</button>
        </div>
      </div>
      <div id="categories-tree"></div>
    </div>
  `;
  bucketTabsEl = root.querySelector('#bucket-tabs');
  treeEl = root.querySelector('#categories-tree');

  root.querySelector('#category-refresh-btn').addEventListener('click', reload);
  root.querySelector('#new-category-btn').addEventListener('click', () => {
    if (activeBucketId != null) openCategoryForm(null, activeBucketId);
  });
  treeEl.addEventListener('click', onTreeClick);

  await reload();
}

async function reload() {
  treeEl.innerHTML = `<div class="text-sm text-slate-400 py-8 text-center">加载中...</div>`;
  try {
    flatCategories = await CategoriesApi.list();
    buckets = flatCategories.filter((c) => c.pid == null).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (activeBucketId == null || !buckets.some((b) => b.id === activeBucketId)) {
      activeBucketId = buckets[0]?.id ?? null;
    }
    renderBucketTabs();
    renderTree();
  } catch (err) {
    treeEl.innerHTML = `<div class="text-sm text-red-500 py-8 text-center">${escapeHtml(err.message)}</div>`;
  }
}

function renderBucketTabs() {
  bucketTabsEl.innerHTML = buckets
    .map((b) => `<button type="button" data-bucket="${b.id}" class="tab-btn shrink-0 ${b.id === activeBucketId ? 'active' : ''}">${escapeHtml(b.name)}</button>`)
    .join('');
  bucketTabsEl.querySelectorAll('[data-bucket]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeBucketId = Number(btn.dataset.bucket);
      renderBucketTabs();
      renderTree();
    });
  });
}

function isBucketRoot(id) {
  return buckets.some((b) => b.id === id);
}

function buildBucketTree() {
  const map = new Map();
  for (const cat of flatCategories) map.set(cat.id, { ...cat, children: [] });
  for (const node of map.values()) {
    if (node.pid != null) {
      const parent = map.get(node.pid);
      if (parent) parent.children.push(node);
    }
  }
  const byOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  for (const node of map.values()) node.children.sort(byOrder);
  return map.get(activeBucketId);
}

function getDescendantIds(id) {
  const ids = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const cat of flatCategories) {
      if (cat.pid != null && ids.has(cat.pid) && !ids.has(cat.id)) {
        ids.add(cat.id);
        added = true;
      }
    }
  }
  return ids;
}

function renderTree() {
  if (activeBucketId == null) {
    treeEl.innerHTML = `<div class="text-sm text-slate-400 py-8 text-center">暂无根目录</div>`;
    return;
  }
  const bucketRoot = buildBucketTree();
  if (!bucketRoot) {
    treeEl.innerHTML = `<div class="text-sm text-slate-400 py-8 text-center">未找到该目录</div>`;
    return;
  }
  treeEl.innerHTML = `<ul class="space-y-1">${renderNode(bucketRoot, 0, { isFirst: true, isLast: true })}</ul>`;
}

const CHEVRON_PATH = 'M6.22 4.22a.75.75 0 011.06 0l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06-1.06L10.19 9 6.22 5.28a.75.75 0 010-1.06z';

function renderNode(node, depth, pos) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const status = statusMeta(node.status);
  const isRoot = isBucketRoot(node.id);
  const canReorder = !isRoot;
  return `
    <li>
      <div class="group flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md px-2 py-1.5 hover:bg-slate-50" style="padding-left:${depth * 20 + 8}px">
        ${hasChildren
          ? `<button type="button" data-toggle="${node.id}" class="btn-icon !p-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}">
                <path fill-rule="evenodd" d="${CHEVRON_PATH}" clip-rule="evenodd" />
              </svg>
            </button>`
          : `<span class="inline-block w-5"></span>`}
        <span class="text-sm font-medium text-slate-800">${escapeHtml(node.name)}</span>
        <span class="hidden sm:inline text-xs text-slate-400">#${node.id}</span>
        ${isRoot ? '<span class="badge bg-brand-100 text-brand-700">根目录</span>' : ''}
        <span class="badge ${status.className}">${status.label}</span>
        ${node.isPublic ? '' : '<span class="badge bg-slate-100 text-slate-500">私有</span>'}
        <span class="text-xs text-slate-400"><span class="hidden sm:inline">排序 </span>${node.sortOrder ?? 0}</span>
        <span class="order-last w-full sm:w-auto sm:ml-auto flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          ${canReorder && !pos.isFirst
            ? `<button type="button" data-move-up="${node.id}" class="btn-icon" title="上移">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 -rotate-90"><path fill-rule="evenodd" d="${CHEVRON_PATH}" clip-rule="evenodd" /></svg>
              </button>`
            : ''}
          ${canReorder && !pos.isLast
            ? `<button type="button" data-move-down="${node.id}" class="btn-icon" title="下移">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 rotate-90"><path fill-rule="evenodd" d="${CHEVRON_PATH}" clip-rule="evenodd" /></svg>
              </button>`
            : ''}
          <button type="button" data-add-child="${node.id}" class="btn-icon" title="新建子分类">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path d="M10 3a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5h-5.5v5.5a.75.75 0 01-1.5 0v-5.5h-5.5a.75.75 0 010-1.5h5.5v-5.5A.75.75 0 0110 3z"/></svg>
          </button>
          <button type="button" data-edit="${node.id}" class="btn-icon" title="编辑">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          </button>
          ${isRoot
            ? `<span class="btn-icon opacity-40 cursor-not-allowed" title="根目录受保护，不可删除">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" /></svg>
              </span>`
            : `<button type="button" data-delete="${node.id}" class="btn-icon hover:!text-red-600" title="删除">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zm-3.877 9.415a.75.75 0 10-1.493.17l.5 4.5a.75.75 0 101.492-.17l-.5-4.5zm6.744 0a.75.75 0 00-1.494-.17l.5 4.5a.75.75 0 101.494.17l-.5-4.5z" clip-rule="evenodd" /></svg>
              </button>`}
        </span>
      </div>
      ${hasChildren && !isCollapsed
        ? `<ul>${node.children.map((c, i) => renderNode(c, depth + 1, { isFirst: i === 0, isLast: i === node.children.length - 1 })).join('')}</ul>`
        : ''}
    </li>
  `;
}

function onTreeClick(e) {
  const toggleId = e.target.closest('[data-toggle]')?.dataset.toggle;
  const addChildId = e.target.closest('[data-add-child]')?.dataset.addChild;
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
  const moveUpId = e.target.closest('[data-move-up]')?.dataset.moveUp;
  const moveDownId = e.target.closest('[data-move-down]')?.dataset.moveDown;

  if (toggleId) {
    const id = Number(toggleId);
    if (collapsed.has(id)) collapsed.delete(id);
    else collapsed.add(id);
    renderTree();
  } else if (addChildId) {
    openCategoryForm(null, Number(addChildId));
  } else if (editId) {
    const cat = flatCategories.find((c) => c.id === Number(editId));
    openCategoryForm(cat, null);
  } else if (deleteId) {
    handleDelete(Number(deleteId));
  } else if (moveUpId) {
    handleMove(Number(moveUpId), 'up');
  } else if (moveDownId) {
    handleMove(Number(moveDownId), 'down');
  }
}

async function handleMove(id, direction) {
  const cat = flatCategories.find((c) => c.id === id);
  if (!cat) return;
  const siblings = flatCategories
    .filter((c) => c.pid === cat.pid)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  const idx = siblings.findIndex((c) => c.id === id);
  const swapWith = direction === 'up' ? siblings[idx - 1] : siblings[idx + 1];
  if (!swapWith) return;
  try {
    await Promise.all([
      CategoriesApi.update(cat.id, { sortOrder: swapWith.sortOrder }),
      CategoriesApi.update(swapWith.id, { sortOrder: cat.sortOrder }),
    ]);
    await reload();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function pidOptionsHtml(bucketRootId, excludeIds, selectedPid) {
  const bucketRoot = flatCategories.find((c) => c.id === bucketRootId);
  const options = [];
  if (bucketRoot && !excludeIds.has(bucketRoot.id)) {
    const selected = bucketRoot.id === selectedPid ? 'selected' : '';
    options.push(`<option value="${bucketRoot.id}" ${selected}>${escapeHtml(bucketRoot.name)}（根目录）</option>`);
  }
  const walk = (pid, depth) => {
    const children = flatCategories.filter((c) => c.pid === pid && !excludeIds.has(c.id));
    for (const c of children) {
      const prefix = '　'.repeat(depth);
      const selected = c.id === selectedPid ? 'selected' : '';
      options.push(`<option value="${c.id}" ${selected}>${prefix}${escapeHtml(c.name)}</option>`);
      walk(c.id, depth + 1);
    }
  };
  walk(bucketRootId, 1);
  return options.join('');
}

function openCategoryForm(category, forcedParentId) {
  const isEdit = Boolean(category);
  const isRootCategory = isEdit && isBucketRoot(category.id);
  const excludeIds = isEdit ? getDescendantIds(category.id) : new Set();
  const selectedPid = isEdit ? category.pid : (forcedParentId ?? activeBucketId);

  openModal({
    title: isEdit ? `编辑分类 #${category.id}` : '新建分类',
    bodyHtml: `
      <form id="category-form" class="space-y-4">
        <div>
          <label class="label">名称</label>
          <input class="input" name="name" required value="${escapeHtml(category?.name ?? '')}" />
        </div>
        ${isRootCategory
          ? ''
          : `<div>
              <label class="label">父分类</label>
              <select class="input" name="pid">${pidOptionsHtml(activeBucketId, excludeIds, selectedPid)}</select>
            </div>`}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="label">排序值</label>
            <input class="input" type="number" name="sortOrder" value="${category?.sortOrder ?? 0}" />
          </div>
          <div>
            <label class="label">状态</label>
            <select class="input" name="status">
              ${STATUS_OPTIONS.map((s) => `<option value="${s.value}" ${Number(category?.status ?? 1) === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap gap-4 sm:gap-6">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isPublic" ${category?.isPublic ?? true ? 'checked' : ''} /> 公开可见
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isExpand" ${category?.isExpand ? 'checked' : ''} /> 默认展开
          </label>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn-secondary" data-modal-close>取消</button>
      <button type="submit" form="category-form" class="btn-primary">保存</button>
    `,
    onMount: (modalRoot) => {
      modalRoot.querySelector('#category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          name: String(fd.get('name') || '').trim(),
          sortOrder: Number(fd.get('sortOrder') || 0),
          status: Number(fd.get('status')),
          isPublic: fd.get('isPublic') === 'on',
          isExpand: fd.get('isExpand') === 'on',
        };
        if (!isRootCategory) {
          payload.pid = fd.get('pid') ? Number(fd.get('pid')) : activeBucketId;
        }
        try {
          if (isEdit) await CategoriesApi.update(category.id, payload);
          else await CategoriesApi.create(payload);
          closeModal();
          toast(isEdit ? '分类已更新' : '分类已创建', 'success');
          await reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

async function handleDelete(id) {
  const cat = flatCategories.find((c) => c.id === id);
  const ok = await confirmDialog(`确定要删除分类「${cat?.name ?? id}」吗？`, { danger: true, confirmText: '删除' });
  if (!ok) return;

  try {
    await CategoriesApi.remove(id, false);
    toast('分类已删除', 'success');
    await reload();
  } catch (err) {
    if (err.status === 409) {
      const cascade = await confirmDialog(
        `「${cat?.name ?? id}」下还有子分类或站点，是否级联删除全部子分类和站点？此操作不可撤销。`,
        { danger: true, confirmText: '级联删除' }
      );
      if (!cascade) return;
      try {
        await CategoriesApi.remove(id, true);
        toast('分类及其子内容已删除', 'success');
        await reload();
      } catch (err2) {
        toast(err2.message, 'error');
      }
    } else {
      toast(err.message, 'error');
    }
  }
}

export { reload as reloadCategories };
