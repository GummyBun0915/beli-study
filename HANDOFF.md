# Beli Study 接力状态

更新：2026-10-23（Asia/Shanghai）。长期状态以源码、本文和验证报告为准；不保存密码、令牌或对话。

## 当前结论

- 仓库：<https://github.com/GummyBun0915/beli-study>，分支 main。
- 网站：<https://gummybun0915.github.io/beli-study/>，GitHub Pages 自动部署。
- Claude 的 4c42489 / addee98 已完成首次发布；本轮 Codex 修复已发布，代码提交 a0dad4e，Actions 39890211948 成功；真实两账号、共享数据库、实时消息、照片权限及线上浏览器验证均已通过。
- Supabase Free 项目 `beli-private`，ref `avxxytxplxqfkofqchrn`；WXY 和 LHJ 已创建并加入同一个空间，后续登录直接进入，无须再次创建/邀请。
- WXY 初始状态保留原数据的 67 Been / 8 Want，个人排名尚无分数；LHJ 初始个人状态为空。没有为生产账号伪造用餐、分数或历史照片。
- Site URL 与 Redirect URL 均已设置为正式 Pages 地址。
- 公开注册已关闭，匿名登录关闭。账号采用内部标识 + 云端密码认证，界面只选身份、输入密码，无需邮件验证。

## 项目与约束

当前项目：`/Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech`。
原项目：`/Users/jiguang/Desktop/Personal/01_个人项目/dachitech` 永远只读。本轮没有访问该目录；数据验证直接使用本项目哈希清单。

用户已授权本项目修复、配置二人共享及发布到 GummyBun0915。不得将密码存进源码、文档、环境文件、Git、截图或报告；密码只由用户提供并发送到指定 Supabase 的 Auth 服务。

产品不展示上游项目名、上游评级或数据工程说明。WXY 为蓝底 W，LHJ 为 L。餐厅 ID 稳定；同一餐厅一份排名，多次用餐各自记录。餐厅/照片不可编造。

## 本轮修复

1. 创建者头像由姓名首字母生成，不再要求 WXY 必须先创建；增量迁移 `supabase/migrations/20261023_creator_avatar.sql` 已在线执行成功，原始 setup.sql 同步修正。
2. 登录先等本人云端记录加载，切换账号按 user ID 分开缓存，旧身份待同步任务失效；退出仅结束当前设备会话并清空当前显示记录。
3. Profile 和 Feed 使用当前身份头像，LHJ 不再显示 WXY 的 W。
4. Realtime 订阅前显式设置登录 token；网络连接异常显示状态，后台每 30 秒及窗口聚焦时补拉取。真实事件和浏览器无需刷新的增删均已通过。
5. 共同空间可展开对方的多次用餐与照片；照片先按成员权限下载并缓存，不通过公开 URL 暴露新上传文件。
6. 接入云端前，本机状态若不同于云端，保留按 user ID 区分的备份，并提供下载 JSON。JSON 只有记录及图片 ID，不包含照片二进制；不要清除 IndexedDB 后期待备份包含照片文件。
7. 加入支持完整邀请链接或邀请码。二人空间现已建好，日常无需再邀请。
8. 私人账号截图与控制台截图留本地并忽略，不上传公开仓库。原 qa 页面图为测试上下文的视觉证据，可以保留；公开参考原图仍仅本地保存，manifest 跟踪来源。

## 已验证与证据

- `qa/cloud-service-report.json`：真实 WXY/LHJ 密码登录；二人成员关系与 W/L；本人快照持久化；旧 revision 被拒；匿名读表、直接跨用户写入/插入、非成员空间 RPC 被拒；共同清单 Realtime；私有照片成员下载、匿名拒绝、对方不能覆盖/删除所有者照片。
- `qa/cloud-ui-report.json`：两个独立浏览器环境登录、67/0 Been 区分、共享清单自动增删、同浏览器切换账号隔离、刷新保持身份与记录。查看 base 字段区分本地生产构建或线上测试。
- `qa/test-report.json`：重复用餐、排名唯一、重新排名不新增到访、多图/灯箱、搜索、WXY 蓝 W、地图与移动布局通过，无页面错误。
- `npm run check`、`npm run data:verify`（75 餐厅/172 资产）、带 `/beli-study/` base 的 build 均通过。
- 测试仅短暂添加现有餐厅到共同清单以及一张未关联记录的权限测试图片，测试结束已删除；既有记录保持原内容。
- 第三个真实认证账号未创建，尚未做三人并发入场的实测；成员上限由数据库锁与计数检查限制。

## 下一步 / 剩余边界

1. 本轮代码已成功部署；`qa/cloud-ui-report.json` 的 base 为正式线上地址，在线两账号检查通过。后续只按用户反馈处理具体问题，勿反复给真实账号增加测试记录。
2. 手机真机 Safari / Android 体验仍待用户验证。
3. Beli 同一 build 的详情/弹窗/动效原始证据不全，不能称像素级完整复刻完成。
4. GitHub Pages 和预置餐厅/照片是公开静态内容；Profile 登录保护的是成员云端数据，不是整个站点访问门禁。
5. CI 的上游 Action Node 20 迁移提示和地图大 chunk 提示目前不阻止构建；没有为消除提示盲目更换未知版本。

## 运行和后续修改

```sh
cd /Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech
npm run dev
npm run check
npm run data:verify
npm run test:ui
VITE_BASE_PATH=/beli-study/ npm run build
VITE_BASE_PATH=/beli-study/ npm run preview -- --port 4178
```

生产连接来自已提交 `.env.production`，只含公开 URL / publishable key；`.env.local` 仍忽略。workflow 不再注入可能为空的 Actions Variables。不要使用 secret/service_role key。

真实云端检查脚本：`tests/cloud-service.mjs`、`tests/cloud-ui.mjs`，密码仅从调用进程的 `CLOUD_TEST_PASSWORD` 环境变量读取。前者可能创建尚不存在的二人空间，对已有快照仅原样保存；后者要求初始 67/0 Been，不应在用户已新增记录后盲跑该固定计数断言。不要为了测试去重置真实记录。

GitHub connector 已认证为 GummyBun0915，有目标仓库 push/admin 权限。本机 gh 同时有 0915 / 999，默认之前为 999，不能默认用错账号；无需邀请错误账号绕过登录。
