package com.ims.entity;

import java.util.List;

/**
 * 公开合集详情视图对象：合集元信息 + 按 sort_order 排序的文章标题列表。
 */
public class CollectionArticlesVO {
    private Integer id;
    private String name;
    private String description;
    private String coverImage;
    private List<ArticleTitleRef> articles;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCoverImage() {
        return coverImage;
    }

    public void setCoverImage(String coverImage) {
        this.coverImage = coverImage;
    }

    public List<ArticleTitleRef> getArticles() {
        return articles;
    }

    public void setArticles(List<ArticleTitleRef> articles) {
        this.articles = articles;
    }
}
