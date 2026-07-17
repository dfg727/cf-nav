// 顶级分类容器：index/other/h5 是真实存在于 categories 表里的 pid=NULL 根节点，
// 用于承载"这棵子树属于哪个历史分类桶"的归属信息，本身不是面向 v1 老前端的真实内容节点。
export const ROOT_BUCKET_NAMES = ['index', 'other', 'h5'] as const;
export type RootBucketName = (typeof ROOT_BUCKET_NAMES)[number];

export function isRootBucketCategory(cat: { pid: number | null; name: string }): boolean {
    return cat.pid === null && (ROOT_BUCKET_NAMES as readonly string[]).includes(cat.name);
}
