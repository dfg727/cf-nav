export const STATUS_OPTIONS = [
  { value: 0, label: '草稿', className: 'bg-slate-100 text-slate-600' },
  { value: 1, label: '启用', className: 'bg-emerald-100 text-emerald-700' },
  { value: 2, label: '禁用', className: 'bg-amber-100 text-amber-700' },
  { value: 3, label: '已删除', className: 'bg-red-100 text-red-700' },
];

export function statusMeta(value) {
  return STATUS_OPTIONS.find((s) => s.value === Number(value)) || STATUS_OPTIONS[0];
}
