package com.ims.mapper;

import com.ims.entity.ArticleCollectionLink;
import com.ims.entity.ArticleTitleRef;
import com.ims.entity.CollectionArticle;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 合集-文章关联表 Mapper
 */
public interface CollectionArticleMapper {

    /** 幂等插入：已存在则跳过（数据库唯一键兜底，避免重复行） */
    int insertIgnore(CollectionArticle collectionArticle);

    int deleteByCollectionIdAndArticleId(@Param("collectionId") Integer collectionId,
                                         @Param("articleId") Integer articleId);

    int countByCollectionIdAndArticleId(@Param("collectionId") Integer collectionId,
                                        @Param("articleId") Integer articleId);

    /** 当前合集最大 sort_order（无记录返回 null） */
    Integer maxSortOrder(@Param("collectionId") Integer collectionId);

    int updateSortOrder(@Param("collectionId") Integer collectionId,
                        @Param("articleId") Integer articleId,
                        @Param("sortOrder") Integer sortOrder);

    /** 批量 IN 查询：给定文章 ID 列表，返回其所属【公开】合集的链接（按文章 + 排序） */
    List<ArticleCollectionLink> findPublicByArticleIds(@Param("articleIds") List<Integer> articleIds);

    /** 合集内文章标题列表（按 sort_order 排序） */
    List<ArticleTitleRef> findArticlesByCollectionIdOrdered(@Param("collectionId") Integer collectionId);
}
