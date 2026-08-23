package com.ims.entity;

/**
 * 合集内文章标题引用，用于公开合集详情展示（仅含 id 与 title）。
 */
public class ArticleTitleRef {
    private Integer id;
    private String title;

    public ArticleTitleRef() {
    }

    public ArticleTitleRef(Integer id, String title) {
        this.id = id;
        this.title = title;
    }

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
}
