package com.ims.entity;

import java.util.List;

/**
 * 项目作品实体
 */
public class Project {
    private Integer id;
    private String title;
    private String descript;
    private String coverImage;
    // 关联 COS 对象 key 列表（JSON 数组），删除项目时级联清理；列名 image_keys
    private String imageKeys;
    private String github;
    private String demoUrl;

    // 用于前端传递标签 ID 列表（非数据库字段）
    private List<Integer> tagIds;
    // 用于展示关联标签名称
    private List<String> tagNames;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescript() {
        return descript;
    }

    public void setDescript(String descript) {
        this.descript = descript;
    }

    public String getCoverImage() {
        return coverImage;
    }

    public void setCoverImage(String coverImage) {
        this.coverImage = coverImage;
    }

    public String getImageKeys() {
        return imageKeys;
    }

    public void setImageKeys(String imageKeys) {
        this.imageKeys = imageKeys;
    }

    public String getGithub() {
        return github;
    }

    public void setGithub(String github) {
        this.github = github;
    }

    public String getDemoUrl() {
        return demoUrl;
    }

    public void setDemoUrl(String demoUrl) {
        this.demoUrl = demoUrl;
    }

    public List<Integer> getTagIds() {
        return tagIds;
    }

    public void setTagIds(List<Integer> tagIds) {
        this.tagIds = tagIds;
    }

    public List<String> getTagNames() {
        return tagNames;
    }

    public void setTagNames(List<String> tagNames) {
        this.tagNames = tagNames;
    }
}
