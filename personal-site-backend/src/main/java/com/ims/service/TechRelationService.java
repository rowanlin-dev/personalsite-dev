package com.ims.service;

import com.ims.entity.TechRelation;
import com.ims.mapper.TechRelationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
public class TechRelationService {

    private static final List<String> VALID_TYPES = Arrays.asList("same", "collab", "depend", "enhance");

    @Autowired
    private TechRelationMapper techRelationMapper;

    public List<TechRelation> findAll() {
        return techRelationMapper.findAll();
    }

    /**
     * 保存/更新一条关系。relationType 为 null 或 "none" 时表示清除该关系。
     */
    @Transactional
    public boolean save(Integer sourceSkillId, Integer targetSkillId, String relationType) {
        if (sourceSkillId == null || targetSkillId == null || sourceSkillId.equals(targetSkillId)) {
            throw new IllegalArgumentException("关系两端技能无效");
        }
        // 统一方向：小 id 在前，避免重复存储
        if (sourceSkillId > targetSkillId) {
            Integer tmp = sourceSkillId;
            sourceSkillId = targetSkillId;
            targetSkillId = tmp;
        }
        if (relationType == null || "none".equals(relationType) || relationType.isBlank()) {
            techRelationMapper.deleteByPair(sourceSkillId, targetSkillId);
            return true;
        }
        if (!VALID_TYPES.contains(relationType)) {
            throw new IllegalArgumentException("非法的 relationType: " + relationType);
        }
        TechRelation existing = techRelationMapper.findByPair(sourceSkillId, targetSkillId);
        if (existing != null) {
            existing.setRelationType(relationType);
            return techRelationMapper.update(existing) > 0;
        }
        TechRelation relation = new TechRelation();
        relation.setSourceSkillId(sourceSkillId);
        relation.setTargetSkillId(targetSkillId);
        relation.setRelationType(relationType);
        return techRelationMapper.insert(relation) > 0;
    }

    @Transactional
    public boolean deleteBySkillId(Integer skillId) {
        return techRelationMapper.deleteBySkillId(skillId) >= 0;
    }
}
