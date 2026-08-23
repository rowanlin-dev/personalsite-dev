package com.ims.entity;

/**
 * 文章-合集关联链接（批量查询用）：文章 ID + 所属公开合集的 id 与 name。
 */
public class ArticleCollectionLink {
    private Integer articleId;
    private Integer collectionId;
    private String name;

    public ArticleCollectionLink() {
    }

    public ArticleCollectionLink(Integer articleId, Integer collectionId, String name) {
        this.articleId = articleId;
        this.collectionId = collectionId;
        this.name = name;
    }

    public Integer getArticleId() {
        return articleId;
    }

    public void setArticleId(Integer articleId) {
        this.articleId = articleId;
    }

    public Integer getCollectionId() {
        return collectionId;
    }

    public void setCollectionId(Integer collectionId) {
        this.collectionId = collectionId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
