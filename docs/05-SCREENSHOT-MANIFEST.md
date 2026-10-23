# Beli 页面与功能对照（公开资料核验，2026-10-22）

## 来源与证据边界

- [App Store 当前媒体图：Feed](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/e6/a1/02/e6a10227-1684-05d1-0695-b9cc7044c36a/Track__U0028L_U0029__U00281_U0029.png/1284x2778.png)、[My Lists 地图](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/fc/21/7e/fc217ee4-c921-f2f9-2953-7cd6a7963792/Track__U0028L_U0029__U00283_U0029.png/1284x2778.png)、[列表](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/00/b5/14/00b514c6-189c-be4d-db63-c6b7fdae7a3b/Beli__U0028L_U0029__U00282_U0029.png/1284x2778.png)、[Discover](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/61/16/72/6116724c-06a6-068b-0c6c-cf4fafec9378/Discover__U0028L_U0029__U00281_U0029.png/1284x2778.png)、[Profile](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/e3/de/a8/e3dea878-b2df-f017-a804-6fbe0b09cfae/Beli__U0028L_U0029__U00283_U0029.png/1284x2778.png)优先用于 2026 画面比对；它们是 Apple 托管的宣传图，图中手机界面不一定涵盖最新小版本每个状态。
- [Beli 官网](https://beliapp.com/)公开展示的 [旧版地图实屏](https://images.squarespace-cdn.com/content/v1/5d27a2af17e26b0001269fd6/612bba36-2367-4c0a-a18e-e6eb0e3271f4/Website_map.png)、[旧版 Feed 实屏](https://images.squarespace-cdn.com/content/v1/5d27a2af17e26b0001269fd6/60547358-631f-4440-bd44-fd9da1a99950/website_feed.png)、[旧版筛选实屏](https://images.squarespace-cdn.com/content/v1/5d27a2af17e26b0001269fd6/f2ec2f05-e0dd-4cea-8a1f-41853a9af075/website_filters.png)作为布局和流程补充。官网未标注这些图的 App 版本。
- [App Store 官方商品页](https://apps.apple.com/us/app/beli/id1478375386)与 [Google Play 官方商品页](https://play.google.com/store/apps/details?id=com.beliapp.myapp)用于核对当前公开功能与宣传截图。商品页展示的是宣传画面，不等于已登录 App 的完整实时界面。
- Apple 官方编辑文章 [关于餐厅排序](https://apps.apple.com/us/iphone/story/id1862619357)描述「喜欢一家店时和已有最爱比较、选更喜欢的一家」；[关于记录方式](https://apps.apple.com/us/iphone/story/id1847489749)描述吃过后与旧店比较，以及 notes、同行人、菜品、照片和标签。这验证了两两比较的**交互概念**，但没有公开完整比较页或算法。
- 本次无法进入 Beli 登录后状态；餐厅详情、首次打分、两两比较、完整榜单和隐私设置中的精确布局与动画均标为**未验证**。这些页面只按可确认的功能逻辑和已见的组件语言实现，不声称逐像素相同。

## 页面与交互

| 页面/流程 | 官方可验证部分 | 本地实现 | 缺口或约束 |
|---|---|---|---|
| Feed | 深蓝绿衬线 `beli` 字标；搜索框、推荐胶囊、FEATURED LISTS 图片横滑卡、YOUR FEED；五栏底部导航 | 使用真实餐厅照片、点评和到访日期形成个人记录 Feed | `dachitech` 无朋友/社交动态，不能伪造朋友内容 |
| Your Lists | 新版顶部 `MY LISTS`、`Restaurants`，横排 Been/Want to Try/Recs/Guides/More；过滤图标与 City/Reserve/Open now/Cuisine 胶囊；绿底刀叉 + 白色数字地图针。旧版另有 List/Map 双按钮 | 去过/想去状态、列表/地图、筛选、选中联动 | 源坐标只覆盖 36/75；无坐标项仅进列表；Reserve/Open now 无源字段，不伪造结果 |
| 筛选抽屉 | Selected list：Been/Want to Try；Sort by Score/Distance/Date added；分类折叠区；Clear all/Apply | 列表、城市、菜系、价格、关键词、排序，底部抽屉应用 | 距离排序需要当前位置权限；本版仅在提供位置后可用 |
| Search | 底部导航中央搜索/加号入口，Feed 有餐厅/菜系/场合搜索 | 全量店名、地域、菜系、菜品、点评搜索 | 无真实“场合”字段；不造场合标签 |
| Leaderboard | 底部奖杯入口与个人页 Leaderboards 项 | 对用户已比较的餐厅给出个人排序 | 上游整店分数全空；初始仅显示源推荐级别，不伪装 Beli 分数 |
| Profile | 新版宣传图可见头像/姓名、handle、Member since、Followers/Following/Rank on Beli、Been/Want to Try 列表入口 | 本地个人资料、真实数据统计和个人榜单入口 | 无账号与关系数据，关注数等社交指标不伪造 |
| 餐厅详情 | 官方文案确认 notes、favorite dishes、标签与个人评价 | 真实封面/图库、地址、菜品、点评、去过/想去、打分入口 | 详情精确排版未获公开实屏核验 |
| 打分/两两比较 | Apple 官方编辑文章明确确认「与已有最爱比较并选更喜欢的」 | 本地用户评分和成对比较，可撤销/持久化 | 比较画面及算法细节未获官方验证；实现为明确标注的本地交互 |

## 可观察的视觉语言

新版媒体图中的页面为白底、黑字、深蓝绿品牌色，推荐胶囊改为深蓝绿实底；控件其余部分仍有轻灰底与细描边。主内容窄屏优先，底部固定五栏导航。新版 My Lists 使用上方分类横栏，地图针为绿底刀叉 + 白色分数胶囊；无源评分的点不可填数字。本实现为未打分点使用普通定位标识。页面标题、胶囊、筛选底抽屉、图片卡、导航顺序参照公开实屏。所有中文文案是本地化实现，不代表 Beli 官方中文版。

## 已知无法 1:1 的部分

登录墙后无可验证像素的页面、Beli 私有推荐/Match Score/社交数据与其真实排名算法无法从公开资料取得。App Store/官网公开图只能支持高保真复刻其可见信息架构与画面；本项目在未验证处保留清楚边界，不编造 Beli 内部行为或虚构用户/餐厅。


## 补充资料复核

| 证据 ID | 本地文件 | 页面 / 状态 | 版本边界 | 目标路由 |
|---|---|---|---|---|
| R01 | [apple-01-feed.png](../references/public/apple-01-feed.png) | Feed | 2026-10-22；具体 App build 未核实 | /#/feed |
| R02 | [apple-02-map.png](../references/public/apple-02-map.png) | My Lists map | 2026-10-22；具体 App build 未核实 | /#/lists |
| R03 | [apple-03-activity.png](../references/public/apple-03-activity.png) | Activity | 2026-10-22；具体 App build 未核实 | /#/feed |
| R04 | [apple-04-discover.png](../references/public/apple-04-discover.png) | Discover | 2026-10-22；具体 App build 未核实 | 流程参考 |
| R05 | [apple-05-list.png](../references/public/apple-05-list.png) | My Lists recs | 2026-10-22；具体 App build 未核实 | /#/lists |
| R06 | [apple-06-profile.png](../references/public/apple-06-profile.png) | Profile | 2026-10-22；具体 App build 未核实 | /#/profile |
| R07 | [pratt-2026-rating.png](../references/public/pratt-2026-rating.png) | Sentiment and comparison | 2026-09-09；具体 App build 未核实 | 流程参考 |
| R08 | [pratt-2026-save.png](../references/public/pratt-2026-save.png) | Restaurant and save | 2026-09-09；具体 App build 未核实 | 流程参考 |
| R09 | [pratt-2026-featured.png](../references/public/pratt-2026-featured.png) | Featured lists | 2026-09-09；具体 App build 未核实 | /#/lists |
| R10 | [substack-2024-list.png](../references/public/substack-2024-list.png) | Been list (not restaurant detail) | 2024-07-01；具体 App build 未核实 | /#/lists |
| R11 | [lazyweb-2026-onboarding.png](../references/public/lazyweb-2026-onboarding.png) | Onboarding | 2026-05-27；具体 App build 未核实 | 流程参考 |

完整 URL、尺寸、文件 SHA256 与采集日期见 [`references/manifest.json`](../references/manifest.json)。这些文件均为原图下载，没有用 AI 重绘。

- Pratt 文章发表于 2026-09-09，三张图有第三方标注；能够确认三种感受、补充标签/笔记/菜品、A/B 比较与保存按钮状态。标注框不作为产品 UI。
- Julia 文章发表于 2024-07-01。本次实际打开的第一张图是 **Been 列表**，并非餐厅详情；补充材料中的名称已纠正。不能拿它证明 2026 详情页布局。
- Snapshots 文章发表于 2023-05-14，是历史交互说明；页面正文可读，直接抓取图片遇到 403，本项目未绕过限制。
- Lazyweb 页确认“68 screens / Updated May 2026”，公开仅 5 张预览。已保存的第一张是 onboarding；其余未授权内容未当作已获取。公开图库的账号引导不能补足餐厅详情/比较全流程。
- 当前没有同一精确 build 的原始 Feed、地图、详情、排名全套截图和录屏。因此几何 ±4px / 字号 ±2px **尚未达到可验收证据条件**；不能标为像素级通过。
