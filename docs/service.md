# 实时取题服务

## 当前状态

2024 年版整册目录已通过本地真实请求核验，三单元各 8 课时。完整题目和答案的访问尚未开通，免费额度、试用期限和可公开使用的内容范围尚未确认。匿名预览不能满足课时筛选和可靠判分，程序拒收无效题号。

当前代码实现公开目录读取、规范化题包契约和校验服务。`GATEWAY_URL` 指向项目方提供的**规范化适配网关**，并不等于官方题源接口；当前仓库没有声称完成任何厂商的私有 API 适配。拿到正式文档后，需要增加实际适配器，将认证、筛选和字段转换接到该契约。

## 浏览器访问

| 接口 | 方法 | 内容 |
| --- | --- | --- |
| `/api/catalog` | GET | 教材、单元、课时目录 |
| `/api/batches` | POST | 当局实时题包与答案 |

请求格式：

```json
{ "catalogId": "book-id", "lessonIds": ["lesson-id"], "kinds": ["single", "boolean"], "count": 10 }
```

字段定义和运行时约束见 `shared/types.ts`、`shared/contracts.ts`。题干、选项、解析只使用纯文本；图像使用 HTTPS 地址与替代文字。题包须与目录和所选范围相符、题号与题干不重复、数量足够、标准答案指向唯一选项。不能可靠转成单选或判断的题目由适配器排除，不猜答案。界面采用 React 文本节点，禁止注入上游 HTML。

## 规范化网关（待实际题源适配）

服务端配置 `GATEWAY_URL` 与 `GATEWAY_TOKEN` 后，Worker 发起：

- `GET <GATEWAY_URL>/catalog` → `Catalog`。
- `POST <GATEWAY_URL>/batches`，请求为 `BatchRequest` → `QuestionBatch`。
- 使用 `Authorization: Bearer <GATEWAY_TOKEN>`；拒绝重定向；单次请求最长 15 秒。
- 真实响应必须标记 `origin: "live"`。标记本身不能证明内容真实，接入验收仍须保留供应方返回与实际映射证据。
- 若单独配置 `CATALOG_ENDPOINT` 与 `CATALOG_BOOK_ID`，目录由公开目录适配器取得。网关必须使用与该目录相同的课时 ID；实际官方 ID 不同时由服务端明确转换。
- 网关每次接收开局请求都应调用获准使用的题源接口，遵守配额。不得用持久题库或预览回退伪装实时请求。

## 配置与免费额度

本地：复制 `.dev.vars.example` 为 `.dev.vars`，填写服务端配置。前端只允许 `VITE_API_BASE_URL`，不得写入题源密钥。

Workers：使用 `wrangler secret put GATEWAY_TOKEN` 保存凭据；目录地址、目录册次 ID 和网关地址也可使用相同方式配置，避免出现在公共仓库。`ALLOWED_ORIGIN` 为 `https://mutiwangn.github.io`。

Worker 默认每个 IP 每分钟最多准备 12 次题目，CORS 只允许项目网页来源。CORS 不能阻止直接 HTTP 调用；IP 限流也不是全局日额度控制。申请接口后，须依据供应方实际免费额度在适配器增加全局额度检查，并关闭自动付费。接口 429、401、403 都停止本次开局，不自动升级付费计划。

仅准备了 Workers 部署配置与本地 dry-run；尚未部署免费后台，也未验证大陆不同网络下的可达性、延迟和图片显示。是否可长期免费由实际供应方额度和托管条款决定。

## 错误

| HTTP | 代码 | 含义 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` / `INVALID_RANGE` | 设置或目录范围无效 |
| 429 | `RATE_LIMITED` | 本机网络请求过于频繁 |
| 503 | `SOURCE_NOT_CONFIGURED` | 尚无可用真实题源 |
| 503 | `ACCESS_REQUIRED` / `QUOTA_EXHAUSTED` | 权限或免费额度不可用 |
| 502 | `INVALID_UPSTREAM_DATA` / `UPSTREAM_UNAVAILABLE` | 返回内容未通过检查或外部服务失败 |
| 504 | `UPSTREAM_TIMEOUT` | 请求超时 |

失败响应不返回凭据、平台名称、原始页面或堆栈。前端保留所选范围，允许重试，题包和所有配图加载成功前不启动计时。
