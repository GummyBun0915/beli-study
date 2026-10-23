# Beli Study 接力状态

更新：2026-10-23（Asia/Shanghai）。长期状态以源码、本文和验证报告为准；不保存密码、令牌或对话。

## 当前结论

- 首页现为共同用餐 Feed，混排 WXY/LHJ 的独立 VisitEntry，并标明作者。原历史只归 source 基线拥有者；个人评分、状态与榜单未合并。实现及本地真实账号只读验收通过；线上发布以 main 的 Actions 结果为准。

- 仓库：<https://github.com/GummyBun0915/beli-study>，分支 main。
- 网站：<https://gummybun0915.github.io/beli-study/>，GitHub Pages 自动部署。
- Claude 的 4c42489 / addee98 已完成首次发布；本轮 Codex 修复已发布，代码提交 a0dad4e，Actions 39890211948 成功；真实两账号、共享数据库、实时消息、照片权限及线上浏览器验证均已通过。
- Supabase Free 项目 `beli-private`，ref `avxxytxplxqfkofqchrn`；WXY 和 LHJ 已创建并加入同一个空间，后续登录直接进入，无须再次创建/邀请。
- WXY 初始状态保留原数据的 67 Been / 8 Want，个人排名尚无分数；LHJ 初始个人状态为空。没有为生产账号伪造用餐、分数或历史照片。
- Site URL 与 Redirect URL 均已设置为正式 Pages 地址。
- 网页第一屏已改为独立登录页；所有路由需先选 WXY/LHJ、输入密码。有效会话自动恢复，载入本人状态前不挂载个人页面和导航。登录入口已在提交 cfb6fd3 中发布，Actions 39892214196 成功；正式线上地址的登录门禁和真实双账号检查均通过。
- 公开注册已关闭，匿名登录关闭。账号采用内部标识 + 云端密码认证，界面只选身份、输入密码，无需邮件验证。

## 项目与约束

当前项目：`/Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech`。
原项目：`/Users/jiguang/Desktop/Personal/01_个人项目/dachitech` 永远只读。本轮没有访问该目录；数据验证直接使用本项目哈希清单。

用户已授权本项目修复、配置二人共享及发布到 GummyBun0915。不得将密码存进源码、文档、环境文件、Git、截图或报告；密码只由用户提供并发送到指定 Supabase 的 Auth 服务。

产品不展示上游项目名、上游评级或数据工程说明。WXY 为蓝底 W，LHJ 为 L。餐厅 ID 稳定；同一餐厅一份排名，多次用餐各自记录。餐厅/照片不可编造。

## 本轮修复

0. 独立 LoginScreen 与会话/用户数据加载门禁；Profile 不再承载未登录表单。Feed 标明每条记录作者的名字。`npm run test:auth` 验证所有未登录 hash 路由及载入期间无个人内容；登录状态由 Supabase 持久会话恢复，不保存密码。

1. 创建者头像由姓名首字母生成，不再要求 WXY 必须先创建；增量迁移 `supabase/migrations/20261023_creator_avatar.sql` 已在线执行成功，原始 setup.sql 同步修正。
2. 登录先等本人云端记录加载，切换账号按 user ID 分开缓存，旧身份待同步任务失效；退出仅结束当前设备会话并清空当前显示记录。
3. Profile 和 Feed 使用当前身份头像，LHJ 不再显示 WXY 的 W。
4. Realtime 订阅前显式设置登录 token；网络连接异常显示状态，后台每 30 秒及窗口聚焦时补拉取。真实事件和浏览器无需刷新的增删均已通过。
5. 共同空间可展开对方的多次用餐与照片；照片先按成员权限下载并缓存，不通过公开 URL 暴露新上传文件。
6. 接入云端前，本机状态若不同于云端，保留按 user ID 区分的备份，并提供下载 JSON。JSON 只有记录及图片 ID，不包含照片二进制；不要清除 IndexedDB 后期待备份包含照片文件。
7. 加入支持完整邀请链接或邀请码。二人空间现已建好，日常无需再邀请。
8. 私人账号截图与控制台截图留本地并忽略，不上传公开仓库。原 qa 页面图为测试上下文的视觉证据，可以保留；公开参考原图仍仅本地保存，manifest 跟踪来源。

## 已验证与证据

- `qa/shared-feed-report.json`：隔离夹具验证双作者混排、同店不同作者/相同 visit ID 不碰撞、各自分数/榜单不混用、伙伴实时更新及查看 Feed 不修改个人快照。`qa/shared-feed-live-report.json`：真实账号只读核对现有贡献者及个人快照/计数/榜单不变；不往生产空间添加示例记录。

- `qa/cloud-service-report.json`：真实 WXY/LHJ 密码登录；二人成员关系与 W/L；本人快照持久化；旧 revision 被拒；匿名读表、直接跨用户写入/插入、非成员空间 RPC 被拒；共同清单 Realtime；私有照片成员下载、匿名拒绝、对方不能覆盖/删除所有者照片。
- `qa/auth-gate-report.json`：所有未登录路由只渲染登录页，加载期间无个人内容，退出回登录页；base 为正式线上地址。
- `qa/cloud-ui-report.json`：第一屏登录、记住会话、新标签页恢复、两个独立浏览器环境登录、67/0 Been 区分、共享清单自动增删、同浏览器切换账号隔离、刷新保持身份与记录。查看 base 字段区分本地生产构建或线上测试。
- `qa/test-report.json`：重复用餐、排名唯一、重新排名不新增到访、多图/灯箱、搜索、WXY 蓝 W、地图与移动布局通过，无页面错误。
- `npm run check`、`npm run data:verify`（75 餐厅/172 资产）、带 `/beli-study/` base 的 build 均通过。
- 测试仅短暂添加现有餐厅到共同清单以及一张未关联记录的权限测试图片，测试结束已删除；既有记录保持原内容。
- 第三个真实认证账号未创建，尚未做三人并发入场的实测；成员上限由数据库锁与计数检查限制。

## 下一步 / 剩余边界

1. 独立登录入口及共享功能均已成功部署并完成线上复核。`qa/cloud-ui-report.json` 的 base 为正式线上地址，在线两账号检查通过。后续只按用户反馈处理具体问题，勿反复给真实账号增加测试记录。
2. 手机真机 Safari / Android 体验仍待用户验证。
3. Beli 同一 build 的详情/弹窗/动效原始证据不全，不能称像素级完整复刻完成。
4. GitHub Pages 和预置餐厅/照片是公开静态内容；应用界面入口已要求登录，成员云端数据由服务端权限保护；GitHub Pages 的静态文件地址仍公开，不能把前端入口等同服务器对所有静态文件的保密。
5. CI 的上游 Action Node 20 迁移提示和地图大 chunk 提示目前不阻止构建；没有为消除提示盲目更换未知版本。

## 运行和后续修改

```sh
cd /Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech
npm run dev
npm run check
npm run data:verify
npm run test:ui
npm run test:auth
VITE_BASE_PATH=/beli-study/ npm run build
VITE_BASE_PATH=/beli-study/ npm run preview -- --port 4178
```

生产连接来自已提交 `.env.production`，只含公开 URL / publishable key；`.env.local` 仍忽略。workflow 不再注入可能为空的 Actions Variables。不要使用 secret/service_role key。

真实云端检查脚本：`tests/cloud-service.mjs`、`tests/cloud-ui.mjs`，密码仅从调用进程的 `CLOUD_TEST_PASSWORD` 环境变量读取。前者可能创建尚不存在的二人空间，对已有快照仅原样保存；后者要求初始 67/0 Been，不应在用户已新增记录后盲跑该固定计数断言。不要为了测试去重置真实记录。

GitHub connector 已认证为 GummyBun0915，有目标仓库 push/admin 权限。本机 gh 同时有 0915 / 999，默认之前为 999，不能默认用错账号；无需邀请错误账号绕过登录。

## 2026-10-23 Claude 接力（第二轮）

- 8e06efe：发布 Codex 未提交的两人共享 Feed；修测试夹具以兼容 realtime-js v2 数组帧（App 本身无问题），ui 测试在计数排名前等待列表渲染。
- 本轮：Feed「OUR FEED」右侧和空状态加「记录一餐」入口（跳 Search）；详情页「去过 / 想去」改为二选一状态组，「再去了一次 / 记录用餐」降为次级整行按钮；已去过但未排名时显示「还没排名」引导，走 rerank 模式（不新增到访）。
- 「再去了一次」「一起想去」「两人 Feed」均为用户要求的 CUSTOM-EXTENSION，不是 Beli 原版组件；顶部 RESTAURANT 标题与原版差异仍 UNVERIFIED（缺登录后原版截图）。

## 2026-10-23 高德 POI 加店（e3f9bfc）

- Search 输入关键词后出现「没找到？在高德搜索」，按需调用高德 JS API 2.0 `PlaceSearch`（类型限「餐饮服务」；选了城市则 citylimit）。`src/lib/amap.ts`。
- 加的店以 `amap:<POI ID>` 存进**添加者自己的** snapshot `places`（`src/state/useFoodState.ts`），随 beli_states 同步，**未改数据库结构**。App 的 catalog = 静态 75 家 + 自己的 places + 对方 snapshot 里的 places（`mergePlaces`）。对方的店只在自己标记/记录/一起想去时复制进自己的 places，排名不复制。新店对所有人初始无状态（不受 source 基线影响），不进 WXY 的历史 Feed。
- 高德 key/安全密钥复用 dachitech `data/map-config.json`（用户授权）：本地 `.env.local`，线上 repo secrets `AMAP_KEY` / `AMAP_SECURITY` 注入 workflow；不进 git。会出现在前端 bundle，靠高德域名白名单防滥用。
- 127.0.0.1 不在白名单（INVALID_USER_DOMAIN），本地用 `npm run test:amap`（高德桩 + Supabase 桩）；线上 gummybun0915.github.io 已用真实高德验证搜索与加店。
- 未做：海外（高德覆盖差）手动加店；国内地图底图仍是 OpenFreeMap；新加的店无封面图，靠用户记录时上传照片。

## 2026-10-23 高德底图 + 海外加店（bed0206 起）

- 地图：当前要显示的店全部在中国大陆时用高德 JS API 底图（定位针用原始 GCJ-02），否则用 OpenFreeMap。`?map=amap|osm` 可强制切换；localhost/127.0.0.1 默认 OSM（不在高德白名单）。实现在 `src/components/MapPane.tsx`（AmapBasemap / LeafletBasemap 共用 pinSpec）。
- 加店（`src/components/AddPlace.tsx`）：国内走高德；海外地区（日本/新加坡/泰国）走 Photon/OpenStreetMap（`src/lib/osm.ts`，免费免 key、按地区国家代码过滤、界面标注 OSM 版权）；都搜不到可手动填店名/城市/地址（无坐标，不上地图）。PlaceRecord 新增 `source`（amap/osm/manual）和 `country`；海外店导航跳 Google 地图。
- 没用 Google Places：需要用户绑卡开通，且条款不允许长期保存店名/地址（只能存 Place ID）。
- 线上已用真实高德底图（深圳 24 个定位针、点击出预览）和真实 Photon（日本一蘭、新加坡 Jumbo Seafood）验证；本地 `npm run test:amap` 覆盖桩测试。
