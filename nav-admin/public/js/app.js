import { getConfig, setConfig, isConfigured } from './store.js';
import { openModal, closeModal, toast, escapeHtml } from './ui.js';
import { initCategories } from './categories.js';
import { initSites } from './sites.js';
import { CategoriesApi } from './api.js';

const tabs = ['categories', 'sites'];
let activeTab = 'categories';
let categoriesInitialized = false;
let sitesInitialized = false;

const tabButtons = document.querySelectorAll('[data-tab]');
const views = {
  categories: document.getElementById('view-categories'),
  sites: document.getElementById('view-sites'),
};
const connStatusEl = document.getElementById('conn-status');

function switchTab(name) {
  activeTab = name;
  for (const btn of tabButtons) btn.classList.toggle('active', btn.dataset.tab === name);
  for (const key of tabs) views[key].classList.toggle('hidden', key !== name);
  ensureTabLoaded(name);
}

async function ensureTabLoaded(name) {
  if (name === 'categories' && !categoriesInitialized) {
    categoriesInitialized = true;
    await initCategories(document.getElementById('view-categories-inner'));
  }
  if (name === 'sites' && !sitesInitialized) {
    sitesInitialized = true;
    await initSites(document.getElementById('view-sites-inner'));
  }
}

tabButtons.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

function updateConnStatus() {
  const { baseUrl } = getConfig();
  connStatusEl.textContent = baseUrl ? baseUrl : '未配置 API';
}

function openSettingsModal({ forced = false } = {}) {
  const { baseUrl, apiKey } = getConfig();
  openModal({
    title: 'API 设置',
    bodyHtml: `
      <form id="settings-form" class="space-y-4">
        <p class="text-sm text-slate-500">${forced ? '首次使用，请先配置 nav-api 的地址与密钥。' : '修改后将立即用于所有请求，并保存在本浏览器中。'}</p>
        <div>
          <label class="label">API Base URL</label>
          <input class="input" name="baseUrl" required value="${escapeHtml(baseUrl)}" placeholder="https://your-nav-api.example.workers.dev" />
        </div>
        <div>
          <label class="label">API Key</label>
          <input class="input" name="apiKey" type="password" value="${escapeHtml(apiKey)}" placeholder="对应 nav-api 的 api-key 请求头" />
        </div>
      </form>
    `,
    footerHtml: `
      ${forced ? '' : '<button type="button" class="btn-secondary" data-modal-close>取消</button>'}
      <button type="submit" form="settings-form" class="btn-primary">保存并连接</button>
    `,
    onMount: (root) => {
      root.querySelector('#settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        setConfig({ baseUrl: fd.get('baseUrl'), apiKey: fd.get('apiKey') });
        updateConnStatus();
        try {
          await CategoriesApi.list();
          toast('连接成功', 'success');
          closeModal();
          categoriesInitialized = false;
          sitesInitialized = false;
          await ensureTabLoaded(activeTab);
        } catch (err) {
          toast(`连接失败：${err.message}`, 'error');
        }
      });
    },
  });
}

document.getElementById('settings-btn').addEventListener('click', () => openSettingsModal());

updateConnStatus();
switchTab('categories');
if (!isConfigured()) {
  openSettingsModal({ forced: true });
}
