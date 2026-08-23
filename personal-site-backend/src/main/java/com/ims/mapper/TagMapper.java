package com.ims.mapper;

import com.ims.entity.Tag;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

public interface TagMapper {

    List<Tag> findAll();

    List<Tag> findAllWithAliases();

    List<Tag> findTree();

    Tag findById(Integer id);

    List<Tag> findByIds(@Param("ids") List<Integer> ids);

    Tag findByName(String name);

    List<Tag> findByParentId(Integer parentId);

    List<Tag> searchByName(@Param("keyword") String keyword);

    List<Tag> findTechMapTags();

    List<Map<String, Object>> findTagStats();

    List<Map<String, Object>> findTagCloud();

    int insert(Tag tag);

    int update(Tag tag);

    int deleteById(Integer id);

    int countByParentId(Integer parentId);

    int countByName(String name);

    int countByNameExcludingId(@Param("name") String name, @Param("id") Integer id);

    int countAll();
}
