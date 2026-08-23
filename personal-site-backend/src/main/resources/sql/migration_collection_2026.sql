-- 博客合集（Collection）增量迁移：仅可重跑文件，严禁修改根目录 schema.sql
-- 本文件【手动执行】，命令：
--   mysql -u<user> -p<pass> personal_site < migration_collection_2026.sql
-- 不要自动跑（CI / 启动脚本请勿引用本文件）。

-- 合集主表：name 唯一（重名由后端捕获唯一键异常，禁止 500）
CREATE TABLE IF NOT EXISTS collection (
    id            INT          NOT NULL AUTO_INCREMENT,
    name          VARCHAR(60)  NOT NULL,
    description   VARCHAR(255) NULL,
    cover_image   VARCHAR(200) NULL,
    is_public     TINYINT(1)   NOT NULL DEFAULT 1,
    create_time   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    update_time   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_collection_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 合集-文章关联表：多对多，排序用 sort_order；删除合集/文章级联清理关联行
CREATE TABLE IF NOT EXISTS collection_article (
    collection_id INT NOT NULL,
    article_id    INT NOT NULL,
    sort_order    INT NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, article_id),
    KEY idx_ca_article (article_id),
    CONSTRAINT fk_ca_collection FOREIGN KEY (collection_id) REFERENCES collection (id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_article    FOREIGN KEY (article_id)    REFERENCES article    (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
