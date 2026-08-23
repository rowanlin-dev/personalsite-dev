package com.ims.mapper;

import com.ims.entity.Article;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ArticleMapper {

    Long count(@Param("titleKey") String titleKey,
               @Param("tagKey") String tagKey);

    List<Article> findPage(@Param("offset") Integer offset,
                           @Param("size") Integer size,
                           @Param("sortField") String sortField,
                           @Param("sortOrder") String sortOrder,
                           @Param("titleKey") String titleKey,
                           @Param("tagKey") String tagKey);

    Article findById(@Param("id") Integer id);

    int insert(Article article);

    int update(Article article);

    int deleteById(@Param("id") Integer id);

    int increaseViewCount(@Param("id") Integer id);

    int increaseLikeCount(@Param("id") Integer id);

    Long sumViewCount();

    Long sumLikeCount();
}
