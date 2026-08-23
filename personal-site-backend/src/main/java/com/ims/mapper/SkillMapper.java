package com.ims.mapper;

import com.ims.entity.Skill;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface SkillMapper {

    Long count();

    List<Skill> findPage(@Param("offset") Integer offset,
                         @Param("size") Integer size,
                         @Param("sortField") String sortField,
                         @Param("sortOrder") String sortOrder);

    Skill findById(@Param("id") Integer id);

    List<Skill> findAll();

    List<Skill> findByTagId(@Param("tagId") Integer tagId);

    int countByTagId(@Param("tagId") Integer tagId);

    int insert(Skill skill);

    int update(Skill skill);

    int deleteById(@Param("id") Integer id);
}
