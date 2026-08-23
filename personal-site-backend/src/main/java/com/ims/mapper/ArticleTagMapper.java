package com.ims.mapper;

import com.ims.entity.ArticleTag;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ArticleTagMapper {

    List<ArticleTag> findByArticleId(Integer articleId);

    List<ArticleTag> findByArticleIds(@Param("articleIds") List<Integer> articleIds);

    List<ArticleTag> findByTagId(Integer tagId);

    int insert(ArticleTag articleTag);

    int deleteByArticleId(Integer articleId);

    int deleteByArticleIdAndTagId(@Param("articleId") Integer articleId, @Param("tagId") Integer tagId);

    int countByTagId(Integer tagId);
}
