export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const toastRoot = document.getElementById('toast-root');

export function toast(message, type = 'info') {
  const colors = {
    info: 'bg-slate-800',
    success: 'bg-emerald-600',
    error: 'bg-red-600',
  };
  const el = document.createElement('div');
  el.className = `${colors[type] || colors.info} text-white text-sm rounded-md px-4 py-2 shadow-lg transition-opacity duration-300`;
  el.textContent = message;
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.classList.add('opacity-0');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

const modalRoot = document.getElementById('modal-root');

export function closeModal() {
  modalRoot.classList.add('hidden');
  modalRoot.innerHTML = '';
}

export function openModal({ title, bodyHtml, footerHtml, onMount, size = 'md' }) {
  const widthClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size] || 'max-w-lg';
  modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/40" data-modal-backdrop></div>
    <div class="fixed inset-0 flex items-start justify-center overflow-y-auto py-4 sm:py-10 px-3 sm:px-4">
      <div class="card w-full ${widthClass} p-4 sm:p-5 relative">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-slate-900">${escapeHtml(title)}</h2>
          <button type="button" data-modal-close class="btn-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div data-modal-body>${bodyHtml}</div>
        ${footerHtml ? `<div class="mt-5 flex justify-end gap-2" data-modal-footer>${footerHtml}</div>` : ''}
      </div>
    </div>
  `;
  modalRoot.classList.remove('hidden');
  modalRoot.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  modalRoot.querySelector('[data-modal-backdrop]').addEventListener('click', closeModal);
  if (onMount) onMount(modalRoot);
}

export function confirmDialog(message, { danger = false, confirmText = '确认' } = {}) {
  return new Promise((resolve) => {
    openModal({
      title: '请确认',
      size: 'sm',
      bodyHtml: `<p class="text-sm text-slate-600">${escapeHtml(message)}</p>`,
      footerHtml: `
        <button type="button" class="btn-secondary" data-confirm-cancel>取消</button>
        <button type="button" class="${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>${escapeHtml(confirmText)}</button>
      `,
      onMount: (root) => {
        const finish = (result) => {
          closeModal();
          resolve(result);
        };
        root.querySelector('[data-confirm-cancel]').addEventListener('click', () => finish(false));
        root.querySelector('[data-confirm-ok]').addEventListener('click', () => finish(true));
      },
    });
  });
}
