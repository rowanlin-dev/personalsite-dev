-- ========================================================
-- 个人博客系统 PersonalSite 数据库初始化脚本
-- 版本：v2.2 (SSM + Vue，统一标签体系)
-- 技术栈：MySQL 8 + utf8mb4
-- ========================================================

CREATE DATABASE IF NOT EXISTS personal_site
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE personal_site;

-- 管理员表
CREATE TABLE IF NOT EXISTS admin
(
    id          INT PRIMARY KEY AUTO_INCREMENT,
    username    VARCHAR(20) NOT NULL UNIQUE,
    pwd         VARCHAR(64) NOT NULL,
    salt        VARCHAR(32) NOT NULL,
    force_change TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否必须修改初始账号密码，1=必须'
);

-- 安全说明：密码已改用 bcrypt 哈希（定长 60 字符，VARCHAR(64) 可容纳），原 MD5 方案已废弃。
-- salt 列保留但已弃用：bcrypt 哈希自带盐，登录校验不再读取/写入该列（种子账号置空串）。
-- 默认管理员（种子，仅对【全新数据库】生效，见下方 INSERT）：
--   用户名 admin / 口令 <DEFAULT_ADMIN_PASSWORD>（bcrypt cost=12 哈希已写入 pwd，salt 置空串）。
--   force_change=1：首次登录会被后端【强制改密门】拦截（fail-closed，详见拦截器
--   com.ims.interceptor.AdminForceChangeInterceptor），改密成功前无法访问任何后台功能。
-- ⚠️ 本脚本【不可重跑】：admin 表 username 唯一，重复执行会撞唯一键报错；若库已存在，请改用
--   「已存在数据库手动 SQL」（见 docs/features/20260723-默认账号与强制改密.md）单独执行，切勿重跑本文件。
-- 本地生成 bcrypt 哈希示例（口令切勿写入代码/提交）：
--   new at.favre.lib.crypto.bcrypt.BCrypt().withDefaults().hashToString(12, "你的强密码".toCharArray())

-- 种子默认管理员（全新库生效；已存在库请勿重跑，见上方说明与交付文档手动 SQL）
INSERT INTO admin(username, pwd, salt, force_change) VALUES('admin', '$2b$12$1OosXVdKww/qhXTd4TesTO9yt9LzZ6RtkMDWAil/ndSqC/uln8Afm', '', 1);

-- 标签表
CREATE TABLE IF NOT EXISTS tag
(
    id              INT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(30) NOT NULL UNIQUE,
    parent_id       INT,
    is_tech_stack   TINYINT(1) DEFAULT 1,
    show_in_tech_map TINYINT(1) DEFAULT 1,
    description     VARCHAR(200),
    FOREIGN KEY (parent_id) REFERENCES tag (id)
);

-- 标签别名表
CREATE TABLE IF NOT EXISTS tag_alias
(
    id          INT PRIMARY KEY AUTO_INCREMENT,
    tag_id      INT NOT NULL,
    alias_name  VARCHAR(30) NOT NULL UNIQUE,
    FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE
);

-- 技术栈表（skill 是 tag 的熟练度扩展）
CREATE TABLE IF NOT EXISTS skill
(
    id       INT PRIMARY KEY AUTO_INCREMENT,
    tag_id   INT NOT NULL,
    level    INT,
    FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE
);

-- 项目作品表
CREATE TABLE IF NOT EXISTS project
(
    id          INT PRIMARY KEY AUTO_INCREMENT,
    title       VARCHAR(100),
    descript    TEXT,
    cover_image VARCHAR(200),
    github      VARCHAR(200),
    demo_url    VARCHAR(200)
);

-- 项目-标签关联表
CREATE TABLE IF NOT EXISTS project_tag
(
    project_id INT NOT NULL,
    tag_id     INT NOT NULL,
    PRIMARY KEY (project_id, tag_id),
    FOREIGN KEY (project_id) REFERENCES project (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE
);

-- 博客文章表
CREATE TABLE IF NOT EXISTS article
(
    id          INT PRIMARY KEY AUTO_INCREMENT,
    title       VARCHAR(120),
    md_content  TEXT,
    view_count  INT DEFAULT 0,
    like_count  INT DEFAULT 0,
    cover_image VARCHAR(200),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文章-标签关联表
CREATE TABLE IF NOT EXISTS article_tag
(
    article_id INT NOT NULL,
    tag_id     INT NOT NULL,
    PRIMARY KEY (article_id, tag_id),
    FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE
);

-- 网站配置表
CREATE TABLE IF NOT EXISTS site_config
(
    `key`   VARCHAR(50) PRIMARY KEY,
    `value` TEXT
);

INSERT INTO site_config (`key`, `value`) VALUES
('resume_enable', '1'),
('about_title', '你好，我是全栈开发者'),
('about_content', '专注 JavaWeb、Vue、云原生'),
('contact_email', 'your@email.com'),
('contact_github', 'https://github.com/your'),
('contact_wechat', 'your_wechat_qrcode_url'),
('resume_pdf', ''),
('avatar_url', ''),
('avatar_show', '1');

-- 初始标签数据
INSERT INTO tag (name, parent_id, is_tech_stack, show_in_tech_map) VALUES
('前端', NULL, 1, 1),
('后端', NULL, 1, 1),
('数据库', NULL, 1, 1),
('运维', NULL, 1, 1),
('Vue', 1, 1, 1),
('CSS', 1, 1, 1),
('HTML', 1, 1, 1),
('Java', 2, 1, 1),
('Spring', 2, 1, 1),
('MySQL', 3, 1, 1),
('Git', 4, 1, 1);

-- 标签别名示例
INSERT INTO tag_alias (tag_id, alias_name) VALUES
(1, 'frontend'),
(1, 'Front-end'),
(2, 'backend'),
(3, 'database'),
(4, 'devops'),
(5, 'Vue.js'),
(6, 'Cascading Style Sheets'),
(8, 'JavaSE'),
(10, 'MySQL Database');

-- 技能数据示例
INSERT INTO skill (tag_id, level) VALUES
(8, 90),   -- Java
(9, 85),   -- Spring
(5, 88),   -- Vue
(10, 86),  -- MySQL
(6, 82);   -- CSS

-- 项目作品示例
INSERT INTO project (title, descript, cover_image) VALUES
('个人博客系统', '基于 SSM + Vue 的全栈博客系统', ''),
('个人作品集', '展示个人项目与技术的作品集网站', '');

-- 项目标签关联示例
INSERT INTO project_tag (project_id, tag_id) VALUES
(1, 8), (1, 9), (1, 5), (1, 10);

-- 博客文章示例
INSERT INTO article (title, md_content, cover_image) VALUES
('SSM 整合入门', '# SSM 整合', ''),
('Vue3 组件化开发', '# Vue3', '');

-- 文章标签关联示例
INSERT INTO article_tag (article_id, tag_id) VALUES
(1, 8), (1, 9), (1, 10),
(2, 5), (2, 6), (2, 1);
