package com.ims.entity;

/**
 * 文章关联的合集引用（仅含 id 与 name），用于 Article.collections 展示（仅公开合集）。
 */
public class CollectionRef {
    private Integer id;
    private String name;

    public CollectionRef() {
    }

    public CollectionRef(Integer id, String name) {
        this.id = id;
        this.name = name;
    }

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
}
