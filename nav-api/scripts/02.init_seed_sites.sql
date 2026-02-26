-- Seed initial h5 sites (grouped by category, sort_order per category)

-- ========== 常用 ==========

-- 今日热榜官网 (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  '今日热榜官网',
  'https://tophub.today/c/tech',
  '今日热榜提供各站热榜聚合：微信、今日头条、百度、知乎、V2EX、微博、贴吧、豆瓣、天涯、虎扑、Github、抖音...追踪全网热点、简单高效阅读。',
  'https://tophub.today/favicon.ico',
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '今日热榜官网' AND url = 'https://tophub.today/c/tech');

-- 福利吧 (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  '福利吧',
  'https://fuliba2023.net/',
  '福利吧是一个分享福利的平台，通过本站将一些好玩的、好看的、新鲜资讯分享给大家。',
  'https://fuliba2023.net/favicon.ico',
  1,
  1,
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '福利吧' AND url = 'https://fuliba2023.net/');

-- 小红薯去水印 (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  '小红薯去水印',
  'https://tools.94bug.qzz.io/tools/xhs.html',
  '',
  NULL,
  1,
  1,
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '小红薯去水印' AND url = 'https://tools.94bug.qzz.io/tools/xhs.html');

-- MoonTV (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  'MoonTV',
  'https://tv2.6623456.xyz/',
  '',
  NULL,
  1,
  1,
  4,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'MoonTV' AND url = 'https://tv2.6623456.xyz/');

-- Uptime Kuma (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  'Uptime Kuma',
  'https://uptime.94sub.qzz.io/dashboard',
  'Uptime Kuma monitoring tool',
  'https://uptime.6623456.xyz/icon.svg',
  1,
  1,
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Uptime Kuma' AND url = 'https://uptime.94sub.qzz.io/dashboard');

-- aaPanel Linux panel (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  'aaPanel Linux panel',
  'https://a.94sub.qzz.io/0e82fc5c',
  '',
  'https://a.94sub.qzz.io/static/vite/favicon.ico',
  1,
  1,
  6,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'aaPanel Linux panel' AND url = 'https://a.94sub.qzz.io/0e82fc5c');

-- 哪吒监控 Nezha Monitoring (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  '哪吒监控 Nezha Monitoring',
  'https://nz.94sub.qzz.io/',
  '',
  'https://nz.94sub.qzz.io/apple-touch-icon.png',
  1,
  1,
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '哪吒监控 Nezha Monitoring' AND url = 'https://nz.94sub.qzz.io/');

-- 『Viper』软件更新合集 - 蓝奏云 (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  '『Viper』软件更新合集 - 蓝奏云',
  'https://bhvip.lanzoux.com/u/彪煌QQ1846055318',
  '',
  'https://bhvip.lanzoux.com/favicon.ico',
  1,
  1,
  8,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '『Viper』软件更新合集 - 蓝奏云' AND url = 'https://bhvip.lanzoux.com/u/彪煌QQ1846055318');

-- Sites Manage (常用)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '常用' LIMIT 1),
  'Sites Manage',
  'http://tools.94bug.top/vue3/form-sites.html',
  '',
  'http://tools.94bug.top/static/favicon.svg',
  1,
  1,
  9,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Sites Manage' AND url = 'http://tools.94bug.top/vue3/form-sites.html');

-- ========== 涨姿势 ==========

-- 莫问导航 (涨姿势)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '涨姿势' LIMIT 1),
  '莫问导航',
  'https://mwdh.cc/',
  '',
  NULL,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '莫问导航' AND url = 'https://mwdh.cc/');

-- cmliussss.com (涨姿势)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '涨姿势' LIMIT 1),
  'cmliussss.com',
  'https://cmliussss.com/',
  '',
  NULL,
  1,
  1,
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'cmliussss.com' AND url = 'https://cmliussss.com/');

-- 福利吧地址发布页 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '福利吧地址发布页',
  'https://fuliba-1251744788.file.myqcloud.com/',
  '',
  NULL,
  1,
  1,
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '福利吧地址发布页' AND url = 'https://fuliba-1251744788.file.myqcloud.com/');

-- rectg - Telegram 导航 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  'rectg - Telegram 导航',
  'https://www.rectg.com/',
  NULL,
  'https://www.rectg.com/favicon.ico',
  1,
  1,
  4,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'rectg - Telegram 导航' AND url = 'https://www.rectg.com/');

-- 青云志 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '青云志',
  'https://blog.notett.com/',
  '一个又菜又爱玩的小白',
  'https://blog.notett.com/favicon.ico',
  1,
  1,
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '青云志' AND url = 'https://blog.notett.com/');

-- 科技共享导航站 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '科技共享导航站',
  'https://kjgx.168668520.xyz/',
  'Webstack Hugo版主题,网址导航',
  'https://kjgx.168668520.xyz/images/favicon.png',
  1,
  1,
  6,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '科技共享导航站' AND url = 'https://kjgx.168668520.xyz/');

-- 老王导航-个人专属导航页-Navitem (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '老王导航-个人专属导航页-Navitem',
  'http://nav.eooce.com/',
  '个人导航页面，提供常用网站链接和工具集合，让您快速访问常用资源',
  'https://img.icons8.com/lollipop/100/navigation.png',
  1,
  1,
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '老王导航-个人专属导航页-Navitem' AND url = 'http://nav.eooce.com/');

-- ========== 娱乐 ==========

-- NBA直播 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'NBA直播',
  'http://www.5cj.tv/m.html?t=1648021259',
  '',
  'http://www.5cj.tv/favicon.ico',
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'NBA直播' AND url = 'http://www.5cj.tv/m.html?t=1648021259');

-- JRKAN直播 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'JRKAN直播',
  'https://m.jrs15.com/?live',
  'JRKAN直播是知名体育平台,主要为足球迷,篮球迷,电竞等提供直播,新闻资讯,比分数据,原创分析,视频集锦等服务',
  'https://im-imgs-bucket.oss-accelerate.aliyuncs.com/favicon.ico?ver=20190708.3',
  1,
  1,
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'JRKAN直播' AND url = 'https://m.jrs15.com/?live');

-- 番号预览 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '番号预览',
  'https://fanhao.me/',
  '',
  NULL,
  1,
  1,
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '番号预览' AND url = 'https://fanhao.me/');

-- FongMi蜂蜜版电视tvbox盒子APK（持续更新） (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'FongMi蜂蜜版电视tvbox盒子APK（持续更新）',
  'https://blog.upx8.com/3385/comment-page-2#comments',
  'FongMi版的独家优势1、FongMi版刚开发前几版的时候就有安装体验，因为它只出TV版，所以，安卓手机上体验还是感觉也不是太出众；另外，电视直播功能也是最近才支持，最开始是不支持的；2、目前的版本已经相当完善了，没有类似TVbox于俊版那样花里花哨的鸡肋功能，非常极简。其实，使用FongMi版的用户，只需要了...',
  'https://blog.upx8.com/usr/uploads/logo.ico',
  1,
  1,
  4,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'FongMi蜂蜜版电视tvbox盒子APK（持续更新）' AND url = 'https://blog.upx8.com/3385/comment-page-2#comments');

-- 阅读源仓库最新地址 | Link3 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '阅读源仓库最新地址 | Link3',
  'https://link3.cc/yckceo',
  '源仓库地址引导，发布页',
  'https://link3.cc/favicon.ico',
  1,
  1,
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '阅读源仓库最新地址 | Link3' AND url = 'https://link3.cc/yckceo');

-- 电视盒子源 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '电视盒子源',
  'https://cyuan.netlify.app/',
  '',
  'https://cyuan.netlify.app/favicon.ico',
  1,
  1,
  6,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '电视盒子源' AND url = 'https://cyuan.netlify.app/');

-- TOP5大瓜 - 911爆料 - 每日吃瓜情报站 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'TOP5大瓜 - 911爆料 - 每日吃瓜情报站',
  'https://s1ger35app.mnqztoy.xyz/category/rlph/',
  '',
  NULL,
  1,
  1,
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'TOP5大瓜 - 911爆料 - 每日吃瓜情报站' AND url = 'https://s1ger35app.mnqztoy.xyz/category/rlph/');

-- 911爆料 - 每日吃瓜情报站 最新地址 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '911爆料 - 每日吃瓜情报站 最新地址',
  'https://bl04.co/',
  '',
  'https://bl04.co/favicon.ico',
  1,
  1,
  8,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '911爆料 - 每日吃瓜情报站 最新地址' AND url = 'https://bl04.co/');

-- AV中文字幕下载 | JAV字幕 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'AV中文字幕下载 | JAV字幕',
  'https://javzimu.com/',
  '专业的AV中文字幕搜索引擎，提供最新FC2、S1、Moodyz等厂商的影片字幕下载。支持番号搜索，一键下载SRT/ASS字幕文件，无需注册，永久免费。',
  'https://javzimu.com/favicon.ico',
  1,
  1,
  9,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'AV中文字幕下载 | JAV字幕' AND url = 'https://javzimu.com/');

-- 激情小说小说_超好看的激情小说小说_2025激情小说小说排行榜-新笔趣阁 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '激情小说小说_超好看的激情小说小说_2025激情小说小说排行榜-新笔趣阁',
  'https://www.bqgns.com/jq',
  '笔趣阁是广大书友最值得收藏的小说阅读网,收录了当前最火热的小说最新章节,笔趣阁免费提供高质量的无弹窗小说,是广大小说爱好者必备的小说阅读网',
  'https://www.bqgns.com/favicon.ico',
  1,
  1,
  10,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '激情小说小说_超好看的激情小说小说_2025激情小说小说排行榜-新笔趣阁' AND url = 'https://www.bqgns.com/jq');

-- BD影视聚合分享 - 最新高清电影、电视剧资源免费分享 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'BD影视聚合分享 - 最新高清电影、电视剧资源免费分享',
  'https://www.bdjuhe.com/',
  'BD影视分享,主要提供丰富的影视资源下载,并且可以在线云播预览,上映之后三个月内发布枪版,三个月之后发布蓝光高清下载,免费下载电影就来BD影视',
  'https://www.bdjuhe.com/img/favicon.ico',
  1,
  1,
  11,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'BD影视聚合分享 - 最新高清电影、电视剧资源免费分享' AND url = 'https://www.bdjuhe.com/');

-- 总点击榜-PO18全本_自由的小说阅读网 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '总点击榜-PO18全本_自由的小说阅读网',
  'https://www.po18m.com/top.html',
  'PO18全本 集合在线原创、在线免费阅读、线上发布的专属文学服务平台。',
  'https://www.po18m.com/favicon.ico',
  1,
  1,
  12,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '总点击榜-PO18全本_自由的小说阅读网' AND url = 'https://www.po18m.com/top.html');

-- 探花万人迷 Archive (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'Archive - 探花万人迷',
  'https://tanhuawanrenmi.github.io/archive/?tag=%E8%BF%94%E5%9C%BA%E5%A5%B3%E7%A5%9E',
  '探花万人迷',
  'https://tanhuawanrenmi.github.io/img/favicon.ico',
  1,
  1,
  13,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Archive - 探花万人迷' AND url = 'https://tanhuawanrenmi.github.io/archive/?tag=%E8%BF%94%E5%9C%BA%E5%A5%B3%E7%A5%9E');

-- 一周音乐-无损音乐免费下载网站 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '一周音乐-无损音乐免费下载网站',
  'https://1zyy.com/',
  '一周官网提供全网无损音乐、Mp3歌曲免费下载、MP3免费下载、WAV免费下载、音乐免费下载、mp3歌曲免费下载、mp3下载、WAV歌曲免费下载、音乐免费下载、网盘音乐下载、网络音乐排行、网络热门歌曲、非主流音乐、经典老歌、搞笑歌曲、儿童歌曲、网络歌曲等，收录了网上最新歌曲和流行音乐、网络歌曲、好听的歌、非主流音乐、经典老歌、搞笑歌曲、儿童歌曲、英',
  'https://1zyy.com/img/favicon.png',
  1,
  1,
  14,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '一周音乐-无损音乐免费下载网站' AND url = 'https://1zyy.com/');

-- 屋里社 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '屋里社',
  'http://144.34.234.186:5555/',
  '',
  'http://144.34.234.186:5555/favicon.ico',
  1,
  1,
  15,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '屋里社' AND url = 'http://144.34.234.186:5555/');

-- Moovie (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'Moovie,全网影视搜索, 在线观看，无需下载APP',
  'https://moovie.c2v2.com/',
  'Moovie 是一个全网影视聚合搜索网站，支持一键搜索各大资源平台的电影、电视剧和综艺节目，让你轻松找到想看的影片。',
  'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐮</text></svg>',
  1,
  1,
  16,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Moovie,全网影视搜索, 在线观看，无需下载APP' AND url = 'https://moovie.c2v2.com/');

-- 红果果短剧网 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  '红果果短剧网',
  'https://www.hongguoguo.tv/',
  '红果果短剧网2025最新短剧免费观看平台，每日更新霸总追妻火葬场、甜宠先婚后爱、赘婿战神归来、穿越重生、复仇虐渣、古装仙侠等上千部抖音快手红果爆款微短剧，全集高清完整版无广告竖屏在线看，一次性看全集不追更，短剧爱好者最爱！',
  'https://www.hongguoguo.tv/template/Naifei/static/img/favicon.png',
  1,
  1,
  17,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '红果果短剧网' AND url = 'https://www.hongguoguo.tv/');

-- whos.tv - 全球首个AV识图搜索引擎 (娱乐)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '娱乐' LIMIT 1),
  'whos.tv - 全球首个AV识图搜索引擎｜图片搜AV、截图识别番号、AV场景搜索',
  'https://whos.tv/',
  'whos.tv 是专业的日本AV搜索引擎，支持以图搜AV番号，上传图片即可快速匹配番号与系列作品，并定位到截图时间点，精准、快速，私密的帮助用户快速找到想要的AV影片。',
  'https://whos.tv/favicon-96x96.png',
  1,
  1,
  18,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'whos.tv - 全球首个AV识图搜索引擎｜图片搜AV、截图识别番号、AV场景搜索' AND url = 'https://whos.tv/');

-- ========== 工具 ==========

-- 1Panel (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  '1Panel',
  'https://1panel.6623456.xyz/9bf0574fc4',
  '',
  NULL,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '1Panel' AND url = 'https://1panel.6623456.xyz/9bf0574fc4');

-- QuickConnect (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'QuickConnect',
  'https://ifelse01.quickconnect.cn/',
  '',
  'https://ifelse01.quickconnect.cn/favicon.8f5fa591b187b2297da55b6023f86d0f.ico',
  1,
  1,
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'QuickConnect' AND url = 'https://ifelse01.quickconnect.cn/');

-- TickTick (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'TickTick',
  'https://xmpan.lanzoui.com/b010z4dze',
  '',
  'https://images.bakstotre.com/assets/favicon.ico',
  1,
  1,
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'TickTick' AND url = 'https://xmpan.lanzoui.com/b010z4dze');

-- sublink订阅转换 (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'sublink订阅转换',
  'https://sublink.9006.de5.net',
  'Convert and optimize your subscription links easily',
  'https://sublink.9006.de5.net/favicon.ico',
  1,
  1,
  4,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'sublink订阅转换' AND url = 'https://sublink.9006.de5.net');

-- PanSou 盘搜 (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'PanSou 盘搜',
  'https://pansou.6623456.xyz/',
  NULL,
  'https://pansou.965.qzz.io/favicon.ico',
  1,
  1,
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'PanSou 盘搜' AND url = 'https://pansou.6623456.xyz/');

-- cfnew订阅 (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'cfnew订阅',
  'https://cfnew.94sub.de5.net/vpn',
  NULL,
  'https://cfnew.94bug.qzz.io/favicon.ico',
  1,
  1,
  6,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'cfnew订阅' AND url = 'https://cfnew.94sub.de5.net/vpn');

-- 提醒.订阅管理系统 (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  '提醒.订阅管理系统',
  'https://subs.9006.de5.net/',
  '',
  'https://subs.94sub.de5.net/favicon.ico',
  1,
  1,
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '提醒.订阅管理系统' AND url = 'https://subs.9006.de5.net/');

-- eooce proxy (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'eooce proxy',
  'https://eooce-py.94sub.de5.net/',
  '',
  'https://eooce-py.94sub.de5.net/favicon.ico',
  1,
  1,
  8,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'eooce proxy' AND url = 'https://eooce-py.94sub.de5.net/');

-- Merge Subscriptions (工具)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '工具' LIMIT 1),
  'Merge Subscriptions-最好用的订阅管理系统',
  'https://merge-sub.94sub.qzz.io/',
  '',
  'https://merge-sub.94sub.qzz.io/favicon.ico',
  1,
  1,
  9,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Merge Subscriptions-最好用的订阅管理系统' AND url = 'https://merge-sub.94sub.qzz.io/');

-- ========== 杂类 ==========

-- ASUS Login (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  'ASUS Login',
  'http://router.asus.com/Main_Login.asp',
  '',
  NULL,
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'ASUS Login' AND url = 'http://router.asus.com/Main_Login.asp');

-- 红杏云网址导航 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '红杏云网址导航',
  'https://hongxingyun.help/',
  '',
  'https://hongxingyun.help/favicon.ico',
  1,
  1,
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '红杏云网址导航' AND url = 'https://hongxingyun.help/');

-- iKuuu VPN (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  'iKuuu VPN',
  'https://ikuuu.ch/user#',
  '',
  'https://ikuuu.ch/favicon.ico',
  1,
  1,
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'iKuuu VPN' AND url = 'https://ikuuu.ch/user#');

-- 即刻盘 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '即刻盘',
  'https://jikepan.xyz/',
  '',
  NULL,
  1,
  1,
  4,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '即刻盘' AND url = 'https://jikepan.xyz/');

-- U9A9地址發布頁 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  'U9A9地址發布頁',
  'https://u9dz.com/',
  '',
  NULL,
  1,
  1,
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'U9A9地址發布頁' AND url = 'https://u9dz.com/');

-- 小火箭共享账号 | 美区ID / 苹果ID共享 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  '小火箭共享账号 | 美区ID / 苹果ID共享 (已购Shadowrocket) - 翻墙男',
  'https://fanqiangnan.com/appleid.html',
  '小火箭共享账号，提供已购 Shadowrocket 的美区ID（苹果ID），并覆盖港区、日区、台区等地区账号，支持直接登录下载使用。账号每30分钟自动检测更新，一键复制即用，稳定可用。免费获取苹果ID，认准翻墙男。',
  'https://fanqiangnan.com/favicon.ico',
  1,
  1,
  11,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '小火箭共享账号 | 美区ID / 苹果ID共享 (已购Shadowrocket) - 翻墙男' AND url = 'https://fanqiangnan.com/appleid.html');

-- DownloadHD.net | 一键解析下载视频/图片/音频 (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  'DownloadHD.net | 一键解析下载视频/图片/音频',
  'https://downloadhd.net/',
  '',
  'https://downloadhd.net/Favicon.png',
  1,
  1,
  12,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'DownloadHD.net | 一键解析下载视频/图片/音频' AND url = 'https://downloadhd.net/');

-- Share (杂类)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = '杂类' LIMIT 1),
  'Share',
  'https://hitun.laogou.cx/s/8401eee658b6557f15faa2b27fb2ca4e',
  '',
  'https://hitun.laogou.cx/favicon.ico',
  1,
  1,
  13,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Share' AND url = 'https://hitun.laogou.cx/s/8401eee658b6557f15faa2b27fb2ca4e');

-- ========== LanYang ==========

-- 登录 [Jenkins] (LanYang)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = 'LanYang' LIMIT 1),
  '登录 [Jenkins]',
  'http://121.196.104.20:8888/login?from=%2F',
  '',
  'http://121.196.104.20:8888/static/3077f83d/favicon.svg',
  1,
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '登录 [Jenkins]' AND url = 'http://121.196.104.20:8888/login?from=%2F');

-- 物联网充装管理系统 (LanYang)
INSERT INTO sites (category_id, name, url, description, icon, status, is_public, sort_order, created_at, updated_at)
SELECT
  (SELECT id FROM categories WHERE name = 'LanYang' LIMIT 1),
  '物联网充装管理系统',
  'https://iotlpg.117915.com/client/Login.aspx',
  '',
  'https://iotlpg.117915.com/images/cslogo_1.ico',
  1,
  1,
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = '物联网充装管理系统' AND url = 'https://iotlpg.117915.com/client/Login.aspx');
