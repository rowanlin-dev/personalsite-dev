-- 技术栈关系配置表（方案 C：后台手动配置图谱连线类型，未配置时前端回退关键词推断）
-- 执行：mysql -u<user> -p<pass> <db> < migration_tech_relation_2026.sql

CREATE TABLE IF NOT EXISTS tech_relation (
    id               INT          NOT NULL AUTO_INCREMENT,
    source_skill_id INT          NOT NULL,
    target_skill_id INT          NOT NULL,
    relation_type    VARCHAR(16)  NOT NULL COMMENT 'same|collab|depend|enhance',
    created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pair (source_skill_id, target_skill_id),
    KEY idx_target (target_skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术栈节点间关系';
