package com.ims.entity;

/**
 * 技术栈实体（tag 的熟练度扩展）
 */
public class Skill {
    private Integer id;
    private Integer tagId;
    private String tagName;
    private Integer parentId;
    private String parentName;
    private Boolean isTechStack;
    private Boolean showInTechMap;
    private Integer level;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getTagId() {
        return tagId;
    }

    public void setTagId(Integer tagId) {
        this.tagId = tagId;
    }

    public String getTagName() {
        return tagName;
    }

    public void setTagName(String tagName) {
        this.tagName = tagName;
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName;
    }

    public Integer getParentId() {
        return parentId;
    }

    public void setParentId(Integer parentId) {
        this.parentId = parentId;
    }

    public Boolean getIsTechStack() {
        return isTechStack;
    }

    public void setIsTechStack(Boolean isTechStack) {
        this.isTechStack = isTechStack;
    }

    public Boolean getShowInTechMap() {
        return showInTechMap;
    }

    public void setShowInTechMap(Boolean showInTechMap) {
        this.showInTechMap = showInTechMap;
    }

    public Integer getLevel() {
        return level;
    }

    public void setLevel(Integer level) {
        this.level = level;
    }
}
