package com.ims.mapper;

import com.ims.entity.TagAlias;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface TagAliasMapper {

    List<TagAlias> findByTagId(Integer tagId);

    List<TagAlias> findAll();

    TagAlias findByAliasName(String aliasName);

    int insert(TagAlias alias);

    int update(TagAlias alias);

    int deleteById(Integer id);

    int deleteByTagId(Integer tagId);

    int countByAliasName(String aliasName);

    int countByAliasNameExcludingId(@Param("aliasName") String aliasName, @Param("id") Integer id);

    int countByAliasNameExcludingTagId(@Param("aliasName") String aliasName, @Param("tagId") Integer tagId);
}
