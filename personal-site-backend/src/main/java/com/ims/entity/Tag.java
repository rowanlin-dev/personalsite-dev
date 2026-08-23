package com.ims.entity;

import java.util.List;

/**
 * 标签实体
 */
public class Tag {
    private Integer id;
    private String name;
    private Integer parentId;
    private Boolean isTechStack;
    private Boolean showInTechMap;
    private String description;

    // 展示用附加字段
    private String parentName;

    // 后台标签管理展示用：该标签下的别名列表
    private List<TagAlias> aliases;

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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName;
    }

    public List<TagAlias> getAliases() {
        return aliases;
    }

    public void setAliases(List<TagAlias> aliases) {
        this.aliases = aliases;
    }
}
