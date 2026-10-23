# 二人云端共享：免费开通指南

核对日期：2026-10-23。项目、两账号、数据库初始化、前端接入与 Pages 部署均已完成；连接配置在 `.env.production`（仅公开 key），不再需要 Actions Variables。剩余：两账号实际登录联调，见根目录 HANDOFF.md。你不需要购买服务器或域名。

## 费用

- GitHub Pages：公开仓库可使用免费托管。
- Supabase Free：$0/月，当前包含 500 MB 数据库、1 GB 文件存储、5 GB egress 和 5 GB cached egress、50,000 月活用户。两人的文字记录通常远低于这些额度；新上传照片最可能先占满容量。
- 免费项目连续一周无活动可能暂停，需要在控制台恢复；最多两个活跃免费项目。
- 使用预先创建的 WXY / LHJ 两个身份，页面只选择身份并输入密码；后台仍使用密码账号，不依赖邮件发信服务。默认邮件服务目前仅向 Supabase 项目团队邮箱发信，并限每小时 2 封；不要为了 App 登录，把另一人设为项目管理员。

官方来源：[Supabase 价格](https://supabase.com/pricing)、[邮件限制](https://supabase.com/docs/guides/auth/auth-smtp)、[密码登录](https://supabase.com/docs/guides/auth/passwords)、[GitHub Pages 计划](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。免费额度和规则可能变化；以开通当天控制台为准。

## Step 1 — 建立 Supabase 项目

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)，注册/登录你的账号。
2. 创建 Organization，选择 **Free**，不选 Pro。
3. 点 **New project**，名称可填 `beli-private`。
4. 设置并保存 Database password。这个数据库密码不需要给我，也不写入网页代码。
5. Region 选靠近你们的位置；在中国周边使用可考虑面板中可选的新加坡区域。
6. 等项目创建完成。

## Step 2 — 创建你们的两个 App 登录账号

1. 项目左侧打开 **Authentication → Users**。
2. 使用 **Add user / Create user**，分别创建 `wxy@beli.example.com`（WXY）和 `lhj@beli.example.com`（LHJ）两个内部账号，并在控制台设置用户指定的初始密码。这两个地址是内部登录标识，不收邮件，不需要真实邮箱。
3. 创建时启用 **Auto Confirm User**（或同义的邮箱已确认选项），这样首次登录不依赖验证邮件。密码只在控制台设置，不写进代码、文档、环境变量或公开仓库。两个账号使用用户指定的同一初始密码。
4. 在 Authentication 设置里关闭 **Allow new users to sign up**，保留 Email 登录。
5. 只创建这两位 App 用户；不要把另一人添加到 Supabase 的 Organization Team。
6. 对方首次登录后，可以在 App 的共享空间里修改自己的密码。忘记密码的邮件恢复需要另行配置 SMTP，这不影响正常密码登录。

## Step 3 — 建立共享数据表

1. 打开 **SQL Editor → New query**。
2. 复制本项目 [`supabase/setup.sql`](../supabase/setup.sql) 的全部内容。
3. 粘贴到编辑器，点击 **Run**。
4. 成功后，Table Editor 应有 `beli_spaces`、`beli_members`、`beli_states`、`beli_wants` 四张表；Storage 应有私有 bucket `beli-photos`。
5. 保持 RLS 开启。脚本会配置空间成员访问、仅写本人记录、最多二人、照片权限与版本冲突检查。

## Step 4 — 取得两项公开连接配置

在项目的 **Connect / API / Settings → API Keys** 页面找到：

```text
Project URL: https://……supabase.co
Publishable key: sb_publishable_……
```

旧项目可使用 `anon` key。这两项用于前端连接；不要把 `secret`、`service_role`、Database password 或 JWT secret 填到前端。

你可以把 Project URL 和 publishable/anon key 发给我接线；也可按下一步自己填写。

## Step 5 — 连接 GitHub Pages

在项目的新 GitHub 仓库里：

1. 打开 **Settings → Secrets and variables → Actions → Variables**。
2. 新增 Repository variables：

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | 你的 Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 你的 publishable/anon key |

3. 打开 **Actions**，重新运行 **Deploy Pages** 工作流。
4. 完成后打开网页，进入 **Profile → Private space**，应从“尚未开通”变为 WXY / LHJ 身份选择和密码输入。

本地联调时，复制根目录 `.env.example` 为 `.env.local`，填写相同两项，再重启 `npm run dev`。`.env.local` 不提交到 Git。

## Step 6 — 设置站点地址

在 Supabase **Authentication → URL Configuration**：

1. Site URL 填最终发布地址（以实际部署结果为准）。
2. Redirect URLs 加入同一个地址。
3. 若需要本地测试，再加 `http://127.0.0.1:5173/`。

密码登录本身不需要邮件回跳；这项为后续可选邮件登录/恢复保留正确地址。

## Step 7 — WXY 创建二人空间

1. WXY 在 App 的 **Profile → Private space** 选择 WXY 并输入密码登录。
2. 填名字 WXY，点击 **创建空间**。
3. 现有个人记录首次同步到自己的云端账号。
4. 点击 **复制邀请链接**，私下发给另一人。邀请链接会轮换之前未用的邀请。

## Step 8 — 对方加入

1. 对方在自己的手机/浏览器打开邀请链接。
2. 选择 LHJ 并输入密码登录。
3. 名字预填 LHJ，点击 **加入空间**。
4. 对方从空白个人记录开始，不会被算作去过 WXY 的所有餐厅。
5. 空间满两人后，第三个账号不能加入。

## Step 9 — 验证真的互通

- WXY 新建一次用餐，另一人能在共享空间看到 WXY 的记录，但不能改写 WXY 的个人快照。
- 任一人在餐厅详情点“一起想去”，另一人的共同清单同步出现；双方都能移除。
- 刷新、退出再登录，笔记、名次、用餐照片仍保留。
- 同一个账号在两台设备同时修改，旧版本保存应被拒绝，页面提示先载入云端。
- 非成员账号不能读取表或私有照片。

这些检查需要项目开通后实际执行；当前不把“代码已写好”算作云端联调成功。

## 数据可见范围

GitHub Pages 网页、预置餐厅和预置实拍属于公开静态内容；新写的个人状态、笔记、排名、上传照片和共同清单由 Supabase 权限限制为空间成员可见。项目数据库管理者仍有管理权限。

## 免费额度快满或暂停时

在 Supabase 的 Usage 页面查看 Storage / Database / Egress。先清理不需要的大图或导出数据，再决定是否升级；不需要提前购买 Pro。项目因不活跃暂停时，在 Dashboard 恢复即可。照片容量取决于实际文件大小，不能仅按“二人”保证永远用不满。
