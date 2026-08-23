package com.ims.entity;

/**
 * 合集-文章关联实体
 */
public class CollectionArticle {
    private Integer collectionId;
    private Integer articleId;
    private Integer sortOrder;

    public CollectionArticle() {
    }

    public CollectionArticle(Integer collectionId, Integer articleId, Integer sortOrder) {
        this.collectionId = collectionId;
        this.articleId = articleId;
        this.sortOrder = sortOrder;
    }

    public Integer getCollectionId() {
        return collectionId;
    }

    public void setCollectionId(Integer collectionId) {
        this.collectionId = collectionId;
    }

    public Integer getArticleId() {
        return articleId;
    }

    public void setArticleId(Integer articleId) {
        this.articleId = articleId;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
