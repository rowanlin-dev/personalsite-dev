package com.ims.mapper;

import com.ims.entity.Project;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ProjectMapper {

    Long count();

    List<Project> findPage(@Param("offset") Integer offset,
                           @Param("size") Integer size,
                           @Param("sortField") String sortField,
                           @Param("sortOrder") String sortOrder);

    Project findById(@Param("id") Integer id);

    List<Project> findAll();

    int insert(Project project);

    int update(Project project);

    int deleteById(@Param("id") Integer id);
}
