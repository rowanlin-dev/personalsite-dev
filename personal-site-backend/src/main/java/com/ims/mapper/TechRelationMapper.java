package com.ims.mapper;

import com.ims.entity.TechRelation;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TechRelationMapper {

    List<TechRelation> findAll();

    TechRelation findByPair(@Param("sourceSkillId") Integer sourceSkillId,
                            @Param("targetSkillId") Integer targetSkillId);

    int insert(TechRelation relation);

    int update(TechRelation relation);

    int deleteByPair(@Param("sourceSkillId") Integer sourceSkillId,
                     @Param("targetSkillId") Integer targetSkillId);

    int deleteBySkillId(@Param("skillId") Integer skillId);
}
