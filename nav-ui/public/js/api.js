import { getConfig } from './store.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  const { baseUrl, apiKey } = getConfig();
  if (!baseUrl) throw new ApiError('尚未配置 API 地址，请先点击右上角设置', 0);

  const url = new URL(`${baseUrl}/api/v2${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(`无法连接到 API (${baseUrl})：${err.message}`, 0);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && data.error) || `请求失败 (HTTP ${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data;
}

export const CategoriesApi = {
  list: () => request('/categories'),
  tree: () => request('/categories/tree'),
  create: (payload) => request('/categories', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/categories/${id}`, { method: 'PUT', body: payload }),
  remove: (id, cascade) => request(`/categories/${id}`, { method: 'DELETE', query: { cascade: cascade ? 'true' : undefined } }),
};

export const SitesApi = {
  list: (categoryId) => request('/sites', { query: { categoryId } }),
  tree: (category) => request('/sites/tree', { query: { category } }),
  create: (payload) => request('/sites', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/sites/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => request(`/sites/${id}`, { method: 'DELETE' }),
};
