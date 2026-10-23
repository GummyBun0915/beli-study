# Beli Study

- 本目录是独立项目。`/Users/jiguang/Desktop/Personal/01_个人项目/dachitech` 永远只读，不进入该目录改文件，不复制密钥和原始私有数据。
- 实现先看源码，再读 README 与 `docs/00-MASTER-SPEC.md`。数据适配唯一说明在 `docs/04-DATA-MAPPING.md`，参考证据在 `docs/05-SCREENSHOT-MANIFEST.md`。
- 产品界面不出现 dachitech、大吃特吃、星其林、导入投影或复刻实现说明；这些只写在工程文档。不得删除或改写原数据以达到文案目的。
- 未登录的所有路由先显示独立登录页；恢复会话及载入本人状态之前，不渲染 Feed、导航或任何个人记录。记住的是 Supabase 会话，不保存密码。
- Feed 只读展示两人的用餐记录，作者必须明确。评分、状态和个人榜单按 user ID 各自独立，禁止为了共同 Feed 合并或复制个人快照；原历史只归拥有 source 基线的成员。
- WXY 的头像是蓝底白色 W；不是 L。个人评分只由用户操作生成。
- 餐厅 ID 稳定。多次用餐保留独立 VisitEntry，同一餐厅只占一份个人排名。不得从“常去”推造日期、次数、分店或照片。
- 新功能检查 `npm run check`、相关交互测试、`npm run build`。云端未配置时不得声称已实现跨设备互通。
- 交付目标仓库属于 GummyBun0915，发布到新仓库；不得覆盖 dachitech。提交前检查无凭据、原始私有数据、浏览器会话。
