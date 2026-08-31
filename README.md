# PersonalSite

基于 **SSM + Vue 3** 的个人博客系统。

---

## 项目简介

本项目为 Java Web 课程设计，采用前后端分离架构：

- **后端**：Spring 6 + SpringMVC 6 + MyBatis 3.5 + Druid + MySQL 8
- **前端**：Vue 3 + Element Plus + Pinia + Vue Router + Axios
- **文件存储**：腾讯云 COS
- **运行环境**：JDK 17 + Tomcat 10.1.x

核心功能包括：文章管理、项目作品展示、技术栈管理、网站配置、管理员登录认证、Markdown 富文本编辑、图片云存储、分页查询与排序等。

---

## 近期主要更新

- **发布流水线优化（v1.0.0）**：前端发布新增 `--fast` 提升（生产机 coscli 并行 sync，322 对象约 15min → 约 4.5s），新增 `scripts/get_cos_creds.py` 一键注入密钥，发布四步收敛为一条命令。
- **匿名点赞 + 三层防刷**：无需登录即可点赞；会话去重 + IP/文章 10min 冷却 + IP 全局 1min 30 次限流。
- **文章目录窗交互升级**：桌面端目录固定左侧可展开/收起，移动端浮动目录图标 + 抽屉。
- **素材库收录（Q4）**：新建文章保存后自动把 draft- 前缀图片迁移到正式前缀；同桶 COS 链接可一键收录进素材库。
- **统一标签体系**：技能、文章标签、项目技术栈统一由 `tag` 表管理，支持父标签、别名、技术栈标识、图谱展示标识。
- **技术栈图谱交互升级**：悬停节点时关联节点与连线联动高亮，其余节点与连线自动变暗。
- **后台仪表盘**：展示文章/项目/技能/标签总数、累计阅读量、累计点赞数。
- **前台微信二维码**：在首页联系入口悬停展示后台配置的微信二维码。
- **敏感配置脱敏**：数据库、COS 等配置集中放到 `.env`，避免提交到 Git。
- **首页头像配置**：后台网站配置支持上传头像并控制是否展示。

## 版本

- 当前版本：**v2.0.0-clean**（脱敏重建公开版；完整变更记录见仓库 Release 页）。

## 文档说明

> 详细设计文档、API 文档、生产部署 Runbook、阶段规划、功能记录等内部资料**不随本仓库公开**。如有需要，请联系作者获取。

---

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p < schema.sql
```

默认管理员账号：`admin` / `<DEFAULT_ADMIN_PASSWORD>`（见 `.env.example` 占位，首次登录强制改密）

> 注：旧版迁移脚本 `migrate_v1_to_v2.sql` 已删除，新环境直接执行 `schema.sql` 即可。

### 2. 配置环境变量（.env）

项目使用 `.env` 集中管理数据库、COS 等敏感配置。

1. 复制模板文件：

```bash
cp .env.example .env
```

2. 编辑 `.env`，填入真实值：

```properties
# 腾讯云 COS 配置
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=your-bucket-name
COS_REGION=your-region
COS_DOMAIN=your-cos-domain
COS_PUBLIC_PREFIX=public/
COS_PRIVATE_PREFIX=private/

# 数据库配置
JDBC_USERNAME=your-db-username
JDBC_PASSWORD=your-db-password
```

3. `.env` 已被 `.gitignore` 忽略，不会提交到 Git；部署时只需在运行目录提供 `.env` 即可。

> 说明：`jdbc.properties` 与 `cos.properties` 中已改为占位符，实际值由 `.env` 在运行时覆盖。

### 3. 用 IDEA 2025 启动后端

#### 方式一：打开根目录（推荐）

1. 打开 IDEA 2025 → `File` → `Open`，选择项目根目录 `PersonalSite`。
2. 等待 Maven 自动识别多模块项目（右下角提示 `Import Changes` 时点击导入）。
3. 配置 JDK：
   - `File` → `Project Structure` → `Project` → SD K 选择 `JDK 17`。
4. 配置 Tomcat 10：
   - 右上角 `Add Configuration...` → `+` → `Tomcat Server` → `Local`。
   - `Application server` 选择本地 `apache-tomcat-10.1.x` 目录。
   - JRE 选择 17。
   - `Deployment` → `+` → `Artifact` → 选择 `personal-site-backend:war exploded`。
   - `Application context` 建议填 `/`，方便前端代理调用 `/api`。
5. **关键：配置 `.env` 路径**
   - 在 Tomcat 运行配置的 `VM options` 中添加：
     ```
     -DAPP_ENV_PATH=<项目根目录>/.env
     ```
     请根据实际路径修改。
   - 或者在 `Server` 标签页将 `Working directory` 设置为项目根目录（包含 `.env` 的目录）。
6. 点击运行按钮，启动 Tomcat，后端地址为 `http://localhost:8080`。

#### 方式二：只导入后端模块

如果只想运行后端，也可以直接打开 `File` → `Open`，选择 `personal-site-backend` 目录。此时 artifact 同样是 `personal-site-backend:war exploded`，部署方式与上面一致。

> **注意**：因为后端读取的是 `file:${APP_ENV_PATH:./.env}`，若 Tomcat 启动目录不是项目根目录，必须配置 `VM options` 中的 `-DAPP_ENV_PATH`，否则启动时会报 `Could not load properties`（找不到 `.env`）。

### 4. 打包后端（可选）

```bash
cd personal-site-backend
mvn clean package
```

将生成的 `target/PersonalSite.war` 部署到 Tomcat 10 的 `webapps/` 目录。

部署时同样需要确保 `.env` 可被加载：
- 将 `.env` 放到 Tomcat 启动目录（通常为 `bin` 目录）；或
- 在 `setenv.bat` / `setenv.sh` 中设置 `APP_ENV_PATH`；或
- 直接设置系统环境变量（如 `COS_SECRET_ID`、`JDBC_USERNAME` 等）。

### 5. 启动前端

```bash
cd personal-site-frontend
npm install
npm run dev
```

前台：`http://localhost:5173`
后台：`http://localhost:5173/admin/login`

---

## 生产发布（前端，一条命令）

前端生产托管在腾讯云 COS + CDN，发布走版本化前缀 + 并行提升：

```bash
cd PersonalSite

# 一键：取生产密钥（ssh 免密，不落盘）→ 构建 → 上传 /releases/<ts>/ → coscli 并行提升到桶根
eval "$(python scripts/get_cos_creds.py)"
python scripts/deploy_frontend.py deploy --build --fast

# 收尾（cloud-ops MCP）：刷新 CDN 入口，两个域名各一次
#   cdn_refresh type=url https://minipluto.cn/index.html
#   cdn_refresh type=url https://www.minipluto.cn/index.html
```

- `--fast`：提升从 coscmd 逐对象 copy（231 对象约 19min）换成生产机 coscli 并行 sync（约 4s）。
- 密钥不落盘：`get_cos_creds.py` 经 ssh 读生产 `/opt/personalsite/.env`，以 `export` 语句输出供 `eval` 注入。
- 回滚：`python scripts/deploy_frontend.py rollback --to <YYYYMMDD-HHMMSS>`（保留近 3 个 release）。

---

## 项目结构

```
PersonalSite/
├── personal-site-backend/       ← SSM 后端
│   ├── src/main/java/com/ims/   ← Controller / Service / Mapper / Entity
│   ├── src/main/resources/      ← Spring / MyBatis / JDBC 配置
│   └── pom.xml
├── personal-site-frontend/      ← Vue 3 前端
│   ├── src/
│   │   ├── api/                 ← 接口封装
│   │   ├── views/               ← 页面
│   │   ├── router/              ← 路由
│   │   └── store/               ← Pinia 状态
│   └── package.json
├── docs/                        ← 文档（本地私有，不随仓库公开）
├── schema.sql                   ← 数据库初始化脚本
├── .env                         ← 本地敏感配置（不提交）
├── .env.example                 ← .env 模板
└── README.md
```
