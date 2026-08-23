package com.ims.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * 删除 COS 对象失败时落库的孤儿记录（兜底，便于后续人工/定时清理）。
 * 也用于接收迁移脚本导出的 migration_purge_failed.json（字段 key/reason）。
 */
public class AssetOrphan {
    private Long id;

    @JsonProperty("key")
    private String objectKey;

    @JsonProperty("reason")
    private String reason;

    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public void setObjectKey(String objectKey) {
        this.objectKey = objectKey;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
