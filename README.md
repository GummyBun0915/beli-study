# Beli Study

移动优先的个人美食记录 Web App，包含个人 Feed 与时间筛选、多图浏览、餐厅列表/地图、搜索、重复用餐记录、个人比较排名和资料页。个人学习研究项目，非 Beli 官方服务。

## 启动

需要 Node.js 22.12+（当前本机使用 Node 25）。

```sh
cd /Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech
npm install
# 首次运行需本地连接配置；已有 .env.local 时保留原文件
test -e .env.local || cp .env.production .env.local
npm run dev
```

打开终端给出的地址，通常是 `http://127.0.0.1:5173/`。请通过这个地址打开，直接双击 `index.html` 不会启动应用。

```sh
npm run check
npm run test:personal
npm run test:dates
npm run test:history
npm run build
npm run preview
```

交互测试使用拦截认证/数据库/实时连接的独立服务夹具，不访问生产数据；auth 测试验证未登录路由与加载期间不显示个人内容。共同 Feed 的作者/排序/评分隔离测试为 test:feed。真实共享联调单独使用 tests/cloud-ui.mjs，纯只读 Feed 验收为 tests/shared-feed-live.mjs。测试默认使用本机 Google Chrome；其他环境设置 `CHROME_PATH`。测试使用独立临时浏览器，不改动你正在使用的记录。

## 当前边界

- 从只读 `dachitech` 公开投影复制 75 家餐厅与 172 个被引用图片资产，餐厅和照片数据保留原样。36 家有坐标，缺位置的店继续显示在列表中。
- 新记录、排名和状态默认保存在当前浏览器。新增照片保存在 IndexedDB。
- 已上线：<https://gummybun0915.github.io/beli-study/>。一个个人云端资料库，首次输入私人访问码后记住设备。初始访问码沿用原 WXY 的密码；Profile 可更换访问码或锁定本设备。Supabase 仍在后台验证凭证并保护数据，不显示账号选择或二人空间。历史 LHJ 数据保留归档，成员访问规则仅允许个人拥有者。
- Feed 支持全部时间、今年、本月、自定义日期；按用餐日期筛选，月份精度按整月区间匹配；未填日期仅在全部时间显示。
- 2026 商店图与 2026-09 实际操作分析用于界面研究；详情页和部分状态没有同一 build 的原始实屏，尚不能声称完整像素级一致。
- 头像偏好：WXY、蓝底白色 W。产品界面不展示数据工程来源或上游评级体系。

## 上游 dachitech 脚本（只读盘点，2026-11-09）

beli-study 的餐厅与实吃数据来自用户 Mac 上的私有项目「大吃特吃」。源目录不在本仓库内：`/Users/jiguang/Desktop/Personal/01_个人项目/dachitech`。下面的脚本都只存在于该目录，本仓库没有这些文件，也不复制其代码或原始数据。

单一数据源是 `data/大吃特吃-餐厅名录.xlsx` 的「大吃特吃」表（稳定 ID、地区、店名、分店、品类、评分、点评、推荐单品、状态、推荐等级、实吃日期、GCJ-02 经纬度、备注）。生成物包括餐厅 JSON、只含文件名/宽高/焦点的图片索引，以及一份留在私有目录、含照片 UUID 映射的导出文件；该映射不进入公开仓库。

**数据管线**（Node / TypeScript）

- `scripts/import-food-sheet.ts`（`npm run data:build`）：表格生成餐厅 JSON。构建可重复；稳定 ID 由内容哈希得出；合并图片索引得到封面与缩略图。可通过环境变量改读别的表格。运行前要求数据政策已人工确认。
- `scripts/build-food-data.ts`：旧的多源构建，已弃用，仅作评分量纲、去重、发布过滤和隐私投影的参考。
- `scripts/import-notion.ts`、`scripts/import-taste-club.ts`：旧源快照导入，已弃用，依赖上游凭据，不建议复用。
- `scripts/export-seed-sheet.py`：一次性把 JSON 导出成带校验的表格模板；目标已存在时拒绝覆盖。
- `scripts/images-manifest.ts`：按稳定 ID 生成拍图命名对照（封面、菜品、环境）。
- `scripts/deploy-public.sh`：按白名单把私有工作区同步到公开仓库，并排除实验目录与 iCloud 冲突副本。
- `scripts/image-admin/server.mjs`：仅监听本机的图片管理页，用于排序、封面、软删除、焦点、上传和从相册候选添加。

**iCloud 图库照片**（`data/photo-match`，Python，只读系统相册）

- `prep_stores.py`：从表格整理实吃与关店清单（排除待吃），保留日期精度和 GCJ 坐标。
- `scan.py`：按时间与地理范围扫描相册并做增量缓存（时间、位置、收藏、缩略图、食物/场景分、人脸面积、美学分）。
- `labels.py`：补全 Vision 分类标签。`fprint.py`：提取特征向量，供去重。
- `os_vision.py`、`r2_vision.py`、`rv_vision.py`：同一套 Vision 分析（分类、中/英/泰 OCR、人脸、美学），三份几乎重复，可收成一个函数。
- `ocr.py`：用高清图识别招牌或菜单，辅助匹配。`q_dates.py`：按日期区间列出照片，含无定位的海外补找。
- `geo.py`：WGS-84 与 GCJ-02 互转，并计算距离。
- `match.py`：在距离、食物置信度、人脸占比和重复特征的约束下，为每家店提出封面与配图，并考虑分店、常去地点和同楼邻店。
- `gen_html.py`、`gen_review2.py` 与 `serve.py`：本机人工确认页（采用、设封面），只监听本机。
- `fetch_photos.py`：按照片标识从 iCloud 取高清、预览或 OCR 用图，需要系统照片授权。
- `export.mjs`、`export_extra.mjs`、`export_r2.mjs`：导出两种边长的 WebP，修正旋转，去掉 EXIF / XMP / IPTC 并校验。公开产物不含照片 UUID；支持增量追加和更换封面。

**可复用到 beli 的方向**（脚本仍留在 dachitech，需另行移植）

1. 历史导入：表格解析、稳定 ID，以及实吃 / 待吃 / 关店到去过、想去和关店标记的对应关系。
2. 实拍配图：扫描、匹配、人工确认、再导出。导出时的双尺寸 WebP 和去除位置信息，适合作为上传前处理，也贴近 Feed 的懒加载缩略图。
3. 去重：同一家店的照片可用特征距离判断重复。
4. 坐标：GCJ 与 WGS 的转换，用于高德坐标和浏览器定位、地图以及「当前位置」附近搜索对齐。

**约束**

- 相册、Vision 和 PhotoKit 脚本只能在 macOS 上跑，并且需要照片授权；不能放进 CI 或云端。匹配结果必须人工确认后才采用。
- 只用真实照片。公开产物不得包含照片 UUID、图库路径、GPS、同行人、凭据或原始私有数据。

## 文档入口

- [总规格与当前状态](docs/00-MASTER-SPEC.md)
- [页面清单](docs/01-APP-INVENTORY.md)
- [设计系统与量测边界](docs/02-DESIGN-SYSTEM.md)
- [交互流程](docs/03-INTERACTION-FLOWS.md)
- [数据字段映射](docs/04-DATA-MAPPING.md)
- [截图证据清单](docs/05-SCREENSHOT-MANIFEST.md)
- [验收与已知差异](docs/06-QA-ACCEPTANCE.md)
- [二人共享开通](docs/07-SHARING-SETUP.md)
- [排名算法](docs/RANKING-MODEL.md)
- [原项目只读盘点](docs/PROJECT-AUDIT.md)

## 只读更新餐厅快照

```sh
npm run data:sync -- /Users/jiguang/Desktop/Personal/01_个人项目/dachitech
npm run data:check
```

同步只复制公开投影及其引用图片。哈希记录在 `data/source-manifest.json`，不写上游目录。个人状态通过稳定餐厅 ID 关联，独立于数据快照。
