package com.ims.entity;

/**
 * 技术栈节点间关系（同类/协作/依赖/增强），用于后台手动配置图谱连线类型。
 * 未配置时前端回退到关键词自动推断。
 */
public class TechRelation {
    private Integer id;
    private Integer sourceSkillId;
    private Integer targetSkillId;
    private String relationType; // same | collab | depend | enhance

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getSourceSkillId() {
        return sourceSkillId;
    }

    public void setSourceSkillId(Integer sourceSkillId) {
        this.sourceSkillId = sourceSkillId;
    }

    public Integer getTargetSkillId() {
        return targetSkillId;
    }

    public void setTargetSkillId(Integer targetSkillId) {
        this.targetSkillId = targetSkillId;
    }

    public String getRelationType() {
        return relationType;
    }

    public void setRelationType(String relationType) {
        this.relationType = relationType;
    }
}
