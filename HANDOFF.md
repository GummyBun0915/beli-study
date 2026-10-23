# Beli Study 接力交接

更新：2026-10-23（Claude 接力完成发布）。

## 0. 当前结论（优先读这一节，下方 §2–§3 为 10-22 的历史状态）

- **已上线**：<https://gummybun0915.github.io/beli-study/>，仓库 <https://github.com/GummyBun0915/beli-study>，main 推送即由 `.github/workflows/pages.yml` 部署。
- 连接配置改为提交 `.env.production`（Project URL + publishable key，本就会进前端 bundle）；workflow 不再读 Actions Variables。`.env.local` 仍忽略。
- 已用 publishable key 核实：`disable_signup=true`、邮箱登录开、匿名关；未登录读 `beli_spaces` 返回 42501。
- 线上跑 `TEST_URL=<上线地址> npm run test:ui` 全过，零页面错误；图片/图标 200。
- 本机 gh 现有两个账号，推送 0915 仓库前确认 `gh auth status`；推送命令：`git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main`。
- **未完成，需用户亲手**（Claude 不代输密码）：①WXY 在 Profile → Private space 登录并“创建空间”（必须 WXY 先建，头像默认 W）；②复制邀请码，LHJ 在另一设备/无痕窗口登录后粘贴加入；③互测共享想去清单同步、各自评分不互相覆盖、刷新保留。出错把 Profile 面板的报错文字发给 Claude。
- 可选：Supabase Auth → URL Configuration 的 Site URL 尚未设（密码登录不依赖）。

## 1. 接力目标与边界

在独立项目完成二人 Supabase 云端共享，再发布到 **GummyBun0915/beli-study**，最后用两个账号验证。

- 当前项目：`/Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech`
- 原项目：`/Users/jiguang/Desktop/Personal/01_个人项目/dachitech`，**永远只读，不能进入改文件**。
- 不另建重复项目，不覆盖原项目，不重做数据审计。
- 用户已授权：配置 WXY / LHJ 两个 App 账号、使用其指定的相同初始密码、关闭公开注册、配置共享数据库、发布到 GummyBun0915 的新 GitHub 仓库。
- 密码已由用户在原对话提供，也已设置到两个 Supabase 账号；**本文、源码、Git 都不保存密码**。接力需要测试登录时，由用户直接在页面输入，或在接力会话安全提供。不要通过读取浏览器隐藏数据找密码或管理令牌。
- 不需要邮件验证码。页面选 WXY / LHJ，再输入密码；后台仍由 Supabase Auth 验证，不能把固定密码写进前端。
- WXY 头像蓝底白 W；LHJ 应显示 L。产品中不显示 dachitech、大吃特吃、星其林、导入/真实来源宣传。共享文案为“共享清单，各自排名。”
- 用户关心每次用餐独立记录；同一店只占一份个人排名。多图必须用真实图片。

## 2. 这一刻的真实状态

### 已在 Supabase 成功完成

浏览器已登录用户自己的 Supabase，发现项目已经存在，无需重建：

- Organization：GummyBun0915's Org，**Free**。
- Project：`beli-private`。
- Project ref：`avxxytxplxqfkofqchrn`。
- Region：`ap-northeast-2`，Seoul。
- Dashboard：<https://supabase.com/dashboard/project/avxxytxplxqfkofqchrn>
- Project URL：`https://avxxytxplxqfkofqchrn.supabase.co`。已在 Data API 页面看到 `/rest/v1/` 地址，非猜测。
- 已通过 Dashboard → Authentication → Users → Add user → Create new user 创建两人，**Auto confirm user 已勾选**，均看到成功提示和列表条目：

| 身份 | 内部登录标识 | Auth user ID |
|---|---|---|
| WXY | `wxy@beli.example.com` | `a9313897-0864-4888-8e4b-f0fc7364149c` |
| LHJ | `lhj@beli.example.com` | `5ae97b14-4180-44d9-b0a1-a11d32242158` |

这两个邮箱是保留域名下的内部标识，不收邮件。初始密码按用户指定设置，未写文件。项目原来另有一条真实邮箱用户，**未修改或删除**。

- 已在 Sign In / Providers 关闭 **Allow new users to sign up** 并点击 **Save changes**；下次应回页面核对保存后的最终开关状态。匿名登录原本关闭，没有开启。
- 已把当前项目 `supabase/setup.sql` 全文填入 SQL Editor，执行并确认，结果明确显示 **Success. No rows returned**。
- 该 SQL 建立 `beli_spaces / beli_members / beli_states / beli_wants`、RLS、RPC、私有照片 bucket、Realtime publication；其 “drop policy if exists” 用于初始化权限，不删除餐厅/记录数据。
- 已看到 API Keys 的 **default publishable key**；未查看/复制 secret/service_role。公开 key 不写在交接里，到面板重新复制。

### 尚未完成

- **`.env.local` 尚不存在**，前端尚未接实际项目。
- 尚未成功登录这两个新账号；尚未创建二人空间、加入空间、上传个人状态。
- 尚未实测 RLS、Realtime、照片权限、跨设备同步。
- 尚未配置 Supabase 站点 URL。
- 尚未把本地源码发布到 GitHub。
- 尚未配置/触发 GitHub Pages。预期地址只是预期，不能称已上线。

### GitHub 的真实状态

- 新公开仓库已创建：<https://github.com/GummyBun0915/beli-study>。
- 默认分支 `main`；目前仅初始化 README commit：`f1afa072bd93f9ccd672acf37c2b5948159c1426`。
- 本地已 git init，origin 指向上述仓库，基于该 initial commit。**绝大多数项目文件尚未跟踪，README 修改未提交**，不是丢文件。
- GitHub connector 当前认证为 **GummyBun0915**，对该仓库有 admin/push 权限，已验证。
- 本机 `gh` 之前认证为 **GummyBun999**，不能默认当成 0915 使用。先核对身份，勿把仓库发到错误账号。
- Chrome 登录态是 GummyBun0915；仓库页面已打开。可用它设置 Pages/Actions variables。
- 用户已授权发布；不需要再问是否允许创建/部署同一个目标仓库。

## 3. 下一步按顺序做

1. **取得公开连接信息**：打开项目 Settings → API Keys，只复制 Publishable key；Project URL 见上。创建本地 `.env.local`，填写 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`。文件已被 `.gitignore` 忽略。不要用 secret/service_role/database password。
2. 检查 Auth Providers 中公开注册确实关闭；保留 Email 密码登录。两个账号已 auto-confirm，毋需改成魔法链接。
3. 在 Supabase Auth → URL Configuration 把 Site URL 设置成 `https://gummybun0915.github.io/beli-study/`；本地调试回跳可补 `http://127.0.0.1:5173/`。密码登录不靠邮件回跳。
4. 启动本地应用，选 WXY 登录，创建空间；这一步应把现有 WXY 本地记录同步为其个人快照。**不要用测试空白状态覆盖用户正在用的浏览器记录**，先保留备份。
5. 用单独浏览器环境选 LHJ 登录，通过 WXY 邀请加入同一空间。LHJ 个人记录从空白开始；不能复制 WXY 的 Been/分数给 LHJ。
6. 验证各自身份/头像、共同想去清单互通、各自评分独立、刷新保留、非成员无法访问、本人不能覆盖对方快照、照片私有访问。不要往实际账号永久塞假餐厅或无意义测试用餐；临时测试有回滚方案。
7. GitHub repo Settings → Secrets and variables → Actions → **Variables** 写入两项同名公开连接配置。密码永不放进 Actions variables 或源码。
8. Repo Settings → Pages → Source 选择 **GitHub Actions**。
9. 检查将要提交的文件，排除 `.env.local`、浏览器状态、密钥、临时调试文件；提交/推送当前完整项目到 `main`。不要只发 dist，不 force 覆盖他人新增提交。
10. 等 `.github/workflows/pages.yml` 完成；打开真正上线的 URL，验证资源路径、地图 worker、图片、WXY/LHJ 登录与共享后才报告部署成功。
11. 更新 README、`docs/00-MASTER-SPEC.md`、`docs/06-QA-ACCEPTANCE.md`、`docs/07-SHARING-SETUP.md` 与本交接为最终状态。交付网站链接、仓库链接、登录方法和剩余边界。

## 4. 实现入口（先读代码，再读旧文档）

- `src/state/identities.ts`：两个公开内部账号地址，**无密码**。
- `src/state/sharedClient.ts`：从两个 Vite 环境变量创建 Supabase client，PKCE + 持久会话。
- `src/state/useSharing.ts`：密码认证、空间创建/加入、本人 JSON 快照、乐观 revision 冲突保护、Realtime、私有照片同步、共同清单。
- `src/components/SharingPanel.tsx`：身份按钮、密码登录、空间邀请与共享清单；未配置时明确提示尚未开通。
- `src/state/useFoodState.ts`：v2 状态，Restaurant / Visit 分离，个人排序和本地持久化。
- `src/state/photos.ts`：IndexedDB 图片存取。
- `src/App.tsx`：路由、列表/详情/Profile。Profile 已用名字首字母及小写 handle；Feed 还有写死 W 的头像需检查 LHJ 登录后是否需要统一。
- `supabase/setup.sql`：已在线执行的脚本；不要无目的重复初始化或手工扩大权限。
- `.github/workflows/pages.yml`：Node 22，npm ci/check/data:verify/build，`VITE_BASE_PATH=/<repo>/`，从 repo variables 读 Supabase 配置，部署 Pages。
- `vite.config.ts`：base 取 `VITE_BASE_PATH`，默认 `/`。
- `docs/07-SHARING-SETUP.md`：操作指南，开通前模板；它目前仍有“尚未开通”的旧状态，应以本交接和控制台实际状态为准。

## 5. 开发与验证

```sh
cd /Users/jiguang/Documents/ChatGPT/项目集/beli-dachitech
npm run dev
npm run check
npm run data:verify
npm run test:ui
VITE_BASE_PATH=/beli-study/ npm run build
```

- `npm run check`、`npm run build`、`npm run test:ui` 最近均通过。构建有地图大 chunk 和 lucide 的 use client 提示，不影响生成；地图已 lazy-load。
- `tests/ui.mjs` 使用系统 Chrome 独立临时上下文，验证重复用餐、排名、照片浏览、搜索、头像、地图、移动端尺寸。默认期望**未配置**云端的状态，因此接入 `.env.local` 后最后的“共享尚未开通”断言需要适配；不要把预期变化当成真实回归。
- `tests/sharing-login.mjs` 只在临时假 Supabase URL/key 下拦截请求验证两个身份、密码不预填、无邮箱输入及失败反馈。**不是实际云端登录成功证明**。不要对真实服务运行它作为成功联调。
- 最近 UI 结果在 `qa/test-report.json`；截图也在 qa。某些截图为临时测试上下文，不是生产种子记录。
- 地图使用 OpenFreeMap Positron + MapLibre/Leaflet，GCJ02 只转换一次为 WGS84；缺坐标餐厅不造坐标。

## 6. 数据与可见范围

- 源公开投影 75 餐厅、172 被引用图片资产，34 店/86 张照片记录；36 店有坐标；原始 score10 全为空。
- `data/source-manifest.json` 保留所有复制文件哈希；`scripts/verify-import.mjs` 不依赖原目录即可验证。
- 原投影 SHA256：`4b7cf49869e6dc6badde505cf2ab32c67938c51c8558b2089e2b42dd1edd3418`。
- 原项目含地图凭据的配置未复制。禁止把整仓原数据/私有配置补上传。
- GitHub Pages 和当前预置餐厅/照片属于公开静态内容；云端新增笔记、排名、照片由成员权限保护。**当前密码入口在 Profile 的共享面板，不是整个静态站的访问门禁**，不可声称 URL 下所有预置内容都私密。
- 评分为文档公开的比较驱动近似算法，不声称等同 Beli 专有算法。Beli 同 build 登录后原始全流程证据仍有缺口，不称完整像素级完成。

## 7. 若 Claude 需要发布而本机 Git 身份不对

优先让用户给 git/gh 登录到 GummyBun0915；也可使用已认证 0915 的 GitHub connector。

Codex 本轮可用 connector：`get_user_login`、`get_repo`、`create_blob`、`create_tree`、`create_commit`、`update_ref`。这些足够上传源码/图片，但不能配置 Pages 或 Actions variables，后两者用已登录 Chrome。

通过 connector 发布时：逐文件 create_blob（图片 base64）、create_tree、以远端 main 最新 head 为 parent 创建 commit、update_ref 带 expected_sha 防止覆盖并发变更。当前 head 见上，但**提交前再次读取远端**。不要复制网页里的认证 token、不要邀请错误账号做管理员来绕过登录。

## 8. 已发现、接力时应检查的具体风险

- 登录态加载/空间初始化尚未对真实服务验证；不要因为编译通过就宣告共享成功。
- SQL create_space 对创建者头像默认 W；若 LHJ 先创建会显示 W，所以按 WXY 创建、LHJ 加入顺序走，或修复该默认后再执行必要迁移。
- Profile 登录前仍显示本机默认档案，空间创建/加入后才加载成员名字；应核对 LHJ 的整个界面而非只看共享面板。
- `.gitignore` 忽略 `references/public/` 原始参考截图，但保留 manifest；本地有原图，远端仅清单时需要说明或补可复现下载方式。
- Supabase Free 有存储和流量额度、一周无活动可能暂停；二人规模不代表无限照片。不要擅自升级付费。
