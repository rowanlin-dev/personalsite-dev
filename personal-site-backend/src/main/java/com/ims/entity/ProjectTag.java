package com.ims.entity;

/**
 * 项目-标签关联实体
 */
public class ProjectTag {
    private Integer projectId;
    private Integer tagId;

    public Integer getProjectId() {
        return projectId;
    }

    public void setProjectId(Integer projectId) {
        this.projectId = projectId;
    }

    public Integer getTagId() {
        return tagId;
    }

    public void setTagId(Integer tagId) {
        this.tagId = tagId;
    }
}
