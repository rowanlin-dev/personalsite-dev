package com.ims.entity;

/**
 * 分页查询参数
 */
public class PageQuery {
    private Integer page = 1;
    private Integer size = 10;
    private String sortField = "id";
    private String sortOrder = "asc";

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        // 边界钳制：null 或 <1 归一到 1（防越界/负数）
        this.page = (page == null || page < 1) ? 1 : page;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        // 边界钳制：null 默认 10；上限 50 防 DoS（大页拉取），下限 1 防 0/负数
        this.size = (size == null) ? 10 : Math.max(1, Math.min(size, 50));
    }

    public String getSortField() {
        return sortField;
    }

    public void setSortField(String sortField) {
        // 排序字段白名单由 SortUtil 在 Service 层统一防护（ArticleService/ProjectService/SkillService
        // 均调用 SortUtil.safeField），此处不重复，避免与白名单漂移。
        this.sortField = sortField;
    }

    public String getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(String sortOrder) {
        // 边界钳制：仅允许 asc/desc（大小写不敏感），其余一律归一到 asc
        this.sortOrder = ("desc".equalsIgnoreCase(sortOrder)) ? "desc" : "asc";
    }
}
