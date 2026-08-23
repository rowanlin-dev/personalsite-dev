-- 素材库（COS 资产）增量迁移：仅可重跑文件，严禁修改根目录 schema.sql
-- 执行：mysql -u<user> -p<pass> <db> < migration_assets_2026.sql

ALTER TABLE article ADD COLUMN image_keys TEXT;
ALTER TABLE project ADD COLUMN image_keys TEXT;

CREATE TABLE IF NOT EXISTS asset_orphan (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    object_key  VARCHAR(512) NOT NULL,
    reason      VARCHAR(255),
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
);
