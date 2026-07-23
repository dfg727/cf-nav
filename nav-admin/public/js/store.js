const KEY_BASE_URL = 'nav_ui_api_base_url';
const KEY_API_KEY = 'nav_ui_api_key';

export function getConfig() {
  return {
    baseUrl: (localStorage.getItem(KEY_BASE_URL) || '').replace(/\/+$/, ''),
    apiKey: localStorage.getItem(KEY_API_KEY) || '',
  };
}

export function setConfig({ baseUrl, apiKey }) {
  localStorage.setItem(KEY_BASE_URL, (baseUrl || '').trim().replace(/\/+$/, ''));
  localStorage.setItem(KEY_API_KEY, (apiKey || '').trim());
}

export function isConfigured() {
  return Boolean(getConfig().baseUrl);
}
