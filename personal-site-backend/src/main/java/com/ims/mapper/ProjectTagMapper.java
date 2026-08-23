package com.ims.mapper;

import com.ims.entity.ProjectTag;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ProjectTagMapper {

    List<ProjectTag> findByProjectId(Integer projectId);

    List<ProjectTag> findByProjectIds(@Param("projectIds") List<Integer> projectIds);

    List<ProjectTag> findByTagId(Integer tagId);

    int insert(ProjectTag projectTag);

    int deleteByProjectId(Integer projectId);

    int deleteByProjectIdAndTagId(@Param("projectId") Integer projectId, @Param("tagId") Integer tagId);

    int countByTagId(Integer tagId);
}
