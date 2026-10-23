# Beli Study

移动优先的美食记录 Web App，包含 Feed、多图浏览、餐厅列表/地图、搜索、重复用餐记录、个人比较排名和资料页。个人学习研究项目，非 Beli 官方服务。

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
npm run test:ui
npm run test:auth
npm run build
npm run preview
```

交互测试使用拦截认证/数据库/实时连接的独立服务夹具，不访问生产数据；auth 测试验证未登录路由与加载期间不显示个人内容。真实共享联调单独使用 tests/cloud-ui.mjs。测试默认使用本机 Google Chrome；其他环境设置 `CHROME_PATH`。测试使用独立临时浏览器，不改动你正在使用的记录。

## 当前边界

- 从只读 `dachitech` 公开投影复制 75 家餐厅与 172 个被引用图片资产，餐厅和照片数据保留原样。36 家有坐标，缺位置的店继续显示在列表中。
- 新记录、排名和状态默认保存在当前浏览器。新增照片保存在 IndexedDB。
- 已上线：<https://gummybun0915.github.io/beli-study/>（GitHub Pages，push main 自动部署）。前端已接入 Supabase（beli-private），打开网页先选择 WXY / LHJ 并输入密码，登录状态会保留；Profile 用于共享管理及退出登录；**两账号真实登录、独立浏览器共享、权限与账号切换已通过验证**，报告和剩余边界见 [HANDOFF](HANDOFF.md)。
- 2026 商店图与 2026-09 实际操作分析用于界面研究；详情页和部分状态没有同一 build 的原始实屏，尚不能声称完整像素级一致。
- 头像偏好：WXY、蓝底白色 W。产品界面不展示数据工程来源或上游评级体系。

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
