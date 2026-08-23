package com.ims.mapper;

import com.ims.entity.ArticleCollection;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 合集主表 Mapper
 */
public interface CollectionMapper {

    /**
     * 合集列表（含实时 article_count：LEFT JOIN 关联表后 GROUP BY 计数）
     */
    List<ArticleCollection> findAll();

    ArticleCollection findById(@Param("id") Integer id);

    int insert(ArticleCollection collection);

    int update(ArticleCollection collection);

    int deleteById(@Param("id") Integer id);
}
