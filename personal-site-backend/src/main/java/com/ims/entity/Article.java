package com.ims.entity;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 博客文章实体
 */
public class Article {
    private Integer id;
    private String title;
    private String mdContent;
    private Integer viewCount;
    private Integer likeCount;
    private String coverImage;

    // 关联 COS 对象 key 列表（JSON 数组），删除文章时级联清理；列名 image_keys
    private String imageKeys;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private LocalDateTime createTime;

    // 用于前端传递标签 ID 列表（非数据库字段）
    private List<Integer> tagIds;
    // 用于展示关联标签名称
    private List<String> tagNames;

    // 非数据库字段：本文章所属【公开】合集引用列表（CollectionRef={id,name}），由 service 批量填充
    private List<CollectionRef> collections;

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

    public String getMdContent() {
        return mdContent;
    }

    public void setMdContent(String mdContent) {
        this.mdContent = mdContent;
    }

    public Integer getViewCount() {
        return viewCount;
    }

    public void setViewCount(Integer viewCount) {
        this.viewCount = viewCount;
    }

    public Integer getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(Integer likeCount) {
        this.likeCount = likeCount;
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

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
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

    public List<CollectionRef> getCollections() {
        return collections;
    }

    public void setCollections(List<CollectionRef> collections) {
        this.collections = collections;
    }
}
