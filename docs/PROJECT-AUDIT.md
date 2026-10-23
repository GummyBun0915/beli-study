# 项目盘点（2026-10-22）

## 隔离边界

新应用位于 `/Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech`。上游 `/Users/jiguang/Desktop/Personal/01_个人项目/dachitech` 只读；同步脚本只把其公开投影和被引用的图片复制到本目录。不得复制 `data/raw/`、`data/map-config.json`、Notion 凭据或其他私有数据。

## 上游实现

- Astro 7.3 + TypeScript 静态站。页面在 `src/pages/`，公共数据类型与路径在 `src/lib/food-data.ts`。
- `src/client/city.ts` 已有搜索、过滤、排序、列表/地图联动；`src/client/map-provider.ts` 有高德与 Leaflet 适配思路；详情使用 PhotoSwipe。新项目参考交互思路，不依赖或改写上游代码。
- 当前公开站点由 `src/data/restaurants.generated.json` 驱动，来源标识 `food-sheet`，生成时间 `2026-10-21T06:13:55.925Z`。原始 Excel 是 `data/大吃特吃-餐厅名录.xlsx`。

## 数据事实与完整性

| 项目 | 审计结果 |
|---|---:|
| Excel 主表 | 80 行：69 实吃、8 待吃、3 关店 |
| 公开餐厅卡 | 75 家：67 去过、8 待吃；2 行不收录、3 次同品牌门店合并 |
| 实拍图片 | 34 家、86 张原图及 86 张缩略图；引用路径均存在 |
| 有地理坐标 | 36 家（国内 30 条 GCJ02、海外 6 条 WGS84） |
| 无地理坐标 | 39 家；不能放置猜测位置的地图针 |
| 有人均价格 | 9 家 |
| 有地址 | 23 家 |
| 有点评 | 46 家 |
| 有推荐单品 | 47 家 |
| 整店 `score10` | 0 家有值；不能换算成 Beli 分数 |

`restaurants.generated.json` 的 SHA256 为 `4b7cf49869e6dc6badde505cf2ab32c67938c51c8558b2089e2b42dd1edd3418`。同步后重新校验所有图片引用与数据条数。Excel 另有 17 条“待补录”页，不视为已发布餐厅。

## 复用与冲突

本应用复制上游的公开投影和对应本地照片，餐厅名称、地域、点评、菜品、图片与坐标来自原记录。Beli 风格的「去过/想去」、比较、分数与个人榜单是本应用的本地交互数据，须在 UI 中与上游的「星其林」推荐级别区分。

上游 `docs/SOURCE-AUDIT.md`、`docs/DEVELOPMENT-PLAN.md`、`HANDOFF.md` 含 2026-09 的待开发/待确认措辞；与现在已构建、已接入照片并发布的源码和 README 不一致。本次以实际代码、生成数据和 Excel 为准，不修改上游旧文档。`data/data-audit.json` 也是旧统计，不用于新应用。
