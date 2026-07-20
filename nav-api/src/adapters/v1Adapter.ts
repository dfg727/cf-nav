import { asc } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { categories, sites } from '../db/schema';
import { ROOT_BUCKET_NAMES, isRootBucketCategory, type RootBucketName } from '../rootCategories';

export interface SiteItemV1 {
    id: number;
    pId: number;
    name: string;
    desc: string | null;
    uri: string | null;
    isExpand: number;
    favicon: string | null;
    status: number;
    category: RootBucketName;
    orderNum: number;
}

type CategoryRow = typeof categories.$inferSelect;
type SiteRow = typeof sites.$inferSelect;

/**
 * 联查 categories 和 sites，并拼装转换为老前端需要的 v1 扁平数组格式。
 *
 * 鉴权已在全局 authMiddleware 中统一收口（所有方法均需合法 api-key），
 * 因此这里始终按管理员视角返回全量数据，不再做 isAdmin/isPublic 分支判断。
 */
export async function getV1SitesFlat(db: DrizzleD1Database, categoryFilter?: string): Promise<SiteItemV1[]> {
    const allCats = await db.select().from(categories).orderBy(asc(categories.sortOrder));
    const allSites = await db.select().from(sites).orderBy(asc(sites.sortOrder));

    // 构建内存分类 Map，用于寻找顶级根分类 ID
    const catMap = new Map<number, CategoryRow>();
    allCats.forEach((cat) => catMap.set(cat.id, cat));

    // 递归查找根分类的 name（index/other/h5 这 3 个真实存在的根节点之一）
    function getRootCategoryName(catId: number): string {
        let current = catMap.get(catId);
        if (!current) return 'other';
        while (current && current.pid !== null && current.pid !== 0) {
            const parent = catMap.get(current.pid);
            if (!parent) break;
            current = parent;
        }
        return current.name;
    }

    // 判断类目分类类型：不再猜 ID 区间，直接读根节点的 name。
    // 兜底 'other'：理论上迁移后所有顶级节点都应该是 index/other/h5 之一，
    // 但如果有人后续通过 v2 API 新建了一个不在这 3 个桶里的顶级分类，保底不让它归类失败。
    function getCategoryType(rootName: string): RootBucketName {
        return (ROOT_BUCKET_NAMES as readonly string[]).includes(rootName)
            ? (rootName as RootBucketName)
            : 'other';
    }

    // index/other/h5 本身不出现在 v1Items 里，所以直属于它们的节点在老前端眼里就是顶级节点，
    // pId 要还原成约定的 0，而不是泄漏这 3 个内部容器节点的真实物理 id。
    function normalizeParentId(rawPid: number | null): number {
        if (rawPid == null) return 0;
        const parent = catMap.get(rawPid);
        if (parent && isRootBucketCategory(parent)) return 0;
        return rawPid;
    }

    const v1Items: SiteItemV1[] = [];

    // 映射分类为 SiteItemV1（index/other/h5 这 3 个容器节点本身跳过，它们只是内部路由用的
    // 根，不是老前端认识的真实分类——跳过后它们的直属子节点在 buildV1Tree 里会因为找不到
    // 父节点而被当成根节点，正好还原出原版"Common Sites 等就是顶级节点"的语义）
    allCats.forEach((cat) => {
        if (isRootBucketCategory(cat)) return;

        const rootName = getRootCategoryName(cat.id);
        const categoryType = getCategoryType(rootName);

        v1Items.push({
            id: cat.id,
            pId: normalizeParentId(cat.pid),
            name: cat.name,
            desc: '',
            uri: null,
            isExpand: cat.isExpand ? 1 : 0,
            favicon: null,
            status: cat.status ?? 1,
            category: categoryType,
            orderNum: cat.sortOrder || 0,
        });
    });

    // 映射站点为 SiteItemV1 (id 直接返回自增物理 ID，不需要运行时加偏移)
    allSites.forEach((site: SiteRow) => {
        if (site.categoryId === null) return;
        const rootName = getRootCategoryName(site.categoryId);
        const categoryType = getCategoryType(rootName);

        v1Items.push({
            id: site.id, // 已经从 SITE_ID_FLOOR (10_000_000) 自增，不会冲突
            pId: normalizeParentId(site.categoryId),
            name: site.name,
            desc: site.description || '',
            uri: site.url,
            isExpand: 0,
            favicon: site.icon || null,
            status: site.status ?? 1,
            category: categoryType,
            orderNum: site.sortOrder || 0,
        });
    });

    // 原 Python 单表版本是 `ORDER BY orderNum ASC` 后一次性建树，分类和站点在同一个物理表里，
    // 天然按 orderNum 整体交叉排序。这里分类和站点来自两张独立的表、各自独立排序后再拼接，
    // 必须补一次全局排序，否则 buildV1Tree 组装时会把"同一父节点下的所有子分类"整体排在
    // "所有子站点"前面，而不是按 orderNum 真实交叉的顺序（当某个节点下既有子分类又有直属站点时可见）。
    v1Items.sort((a, b) => a.orderNum - b.orderNum);

    // 按 category 参数过滤 (index 或 other)
    if (categoryFilter) {
        const filterLower = categoryFilter.toLowerCase();
        return v1Items.filter((item) => item.category === filterLower);
    }

    return v1Items;
}

export interface SiteItemV1Tree extends SiteItemV1 {
    children: SiteItemV1Tree[];
}

/**
 * 将扁平的 SiteItemV1 转换为树形结构。
 *
 * orderNum 只在"同一父节点下的兄弟节点之间"有排序意义——不同分支（比如 h5 下的
 * "常用" 和 "文娱" 各自的子节点）大量存在重复的 orderNum 值（1,2,3...各自从头计），
 * 互相之间的数值大小没有可比性。分组之后必须在每一层各自按 orderNum 重新排序，
 * 不能依赖调用方传入的 flatItems 已经是全局排好序的这个假设。
 */
export function buildV1Tree(flatItems: SiteItemV1[]): SiteItemV1Tree[] {
    const itemMap = new Map<number, SiteItemV1Tree>();
    flatItems.forEach((item) => {
        itemMap.set(item.id, { ...item, children: [] });
    });

    const rootNodes: SiteItemV1Tree[] = [];

    flatItems.forEach((item) => {
        const node = itemMap.get(item.id)!;
        const pid = item.pId;

        // 如果 pid 为 0 或父节点不存在，则为根节点
        if (pid === 0 || !itemMap.has(pid)) {
            rootNodes.push(node);
        } else {
            const parent = itemMap.get(pid)!;
            parent.children.push(node);
        }
    });

    const byOrderNum = (a: SiteItemV1Tree, b: SiteItemV1Tree) => a.orderNum - b.orderNum;
    for (const node of itemMap.values()) {
        node.children.sort(byOrderNum);
    }
    rootNodes.sort(byOrderNum);

    return rootNodes;
}
