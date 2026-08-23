package com.ims.service;

import com.ims.entity.ArticleTitleRef;
import com.ims.entity.ArticleCollection;
import com.ims.entity.CollectionArticlesVO;
import com.ims.entity.CollectionArticle;
import com.ims.mapper.CollectionArticleMapper;
import com.ims.mapper.CollectionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 博客合集业务层
 */
@Service
public class CollectionService {

    @Autowired
    private CollectionMapper collectionMapper;

    @Autowired
    private CollectionArticleMapper collectionArticleMapper;

    /** 合集列表（每项含实时 articleCount） */
    public List<ArticleCollection> findAllWithCount() {
        return collectionMapper.findAll();
    }

    public ArticleCollection findById(Integer id) {
        return collectionMapper.findById(id);
    }

    /**
     * 新建合集。唯一键（name）冲突时由 Controller 捕获 DuplicateKeyException，这里不吞异常。
     */
    @Transactional
    public ArticleCollection create(ArticleCollection collection) {
        if (collection == null || isBlank(collection.getName())) {
            return null;
        }
        collection.setName(collection.getName().trim());
        if (collection.getIsPublic() == null) {
            collection.setIsPublic(true);
        }
        return collectionMapper.insert(collection) > 0 ? collection : null;
    }

    /**
     * 保存合集（upsert，镜像 ArticleController.save）：
     * 有 id → 更新（动态 SQL，未传字段保持原值）；无 id → 新建。
     * 重命名导致 name 唯一键冲突时由 Controller 捕获。
     */
    @Transactional
    public ArticleCollection save(ArticleCollection collection) {
        if (collection == null || isBlank(collection.getName())) {
            return null;
        }
        collection.setName(collection.getName().trim());
        if (collection.getId() == null) {
            if (collection.getIsPublic() == null) {
                collection.setIsPublic(true);
            }
            return collectionMapper.insert(collection) > 0 ? collection : null;
        }
        int updated = collectionMapper.update(collection);
        if (updated <= 0) {
            return null;
        }
        return collectionMapper.findById(collection.getId());
    }

    /**
     * 删除合集（级联清关联行）。
     * 关联行由数据库外键 ON DELETE CASCADE 自动清理；封面存公开 URL、不存 COS key，
     * 故无 COS 级联、无 asset_orphan 逻辑（与文章不同，不要照搬 ArticleService.delete）。
     */
    @Transactional
    public boolean delete(Integer id) {
        if (id == null) {
            return false;
        }
        return collectionMapper.deleteById(id) > 0;
    }

    /**
     * 批量加入文章：幂等（已存在跳过），新项 sort_order = 当前最大 + 1 依次递增。
     */
    @Transactional
    public void addArticles(Integer collectionId, List<Integer> articleIds) {
        if (collectionId == null || articleIds == null || articleIds.isEmpty()) {
            return;
        }
        Integer max = collectionArticleMapper.maxSortOrder(collectionId);
        int next = (max == null ? -1 : max) + 1;
        for (Integer articleId : articleIds) {
            if (articleId == null) {
                continue;
            }
            int exists = collectionArticleMapper.countByCollectionIdAndArticleId(collectionId, articleId);
            if (exists == 0) {
                collectionArticleMapper.insertIgnore(new CollectionArticle(collectionId, articleId, next));
                next++;
            }
        }
    }

    /** 移除单篇文章：幂等，不存在也不报错 */
    @Transactional
    public void removeArticle(Integer collectionId, Integer articleId) {
        if (collectionId == null || articleId == null) {
            return;
        }
        collectionArticleMapper.deleteByCollectionIdAndArticleId(collectionId, articleId);
    }

    /**
     * 按传入顺序重写 sort_order = 0..n-1（事务内逐条更新）。
     */
    @Transactional
    public void sortArticles(Integer collectionId, List<Integer> orderedArticleIds) {
        if (collectionId == null || orderedArticleIds == null) {
            return;
        }
        for (int i = 0; i < orderedArticleIds.size(); i++) {
            Integer articleId = orderedArticleIds.get(i);
            if (articleId == null) {
                continue;
            }
            collectionArticleMapper.updateSortOrder(collectionId, articleId, i);
        }
    }

    /**
     * 组装公开合集详情（合集元信息 + 按 sort_order 排序的标题列表）。
     * 私有合集的访问控制不在此处理，由 Controller 依据 isAdmin 判定。
     */
    public CollectionArticlesVO buildArticles(Integer id) {
        ArticleCollection col = collectionMapper.findById(id);
        CollectionArticlesVO vo = new CollectionArticlesVO();
        if (col == null) {
            return vo;
        }
        vo.setId(col.getId());
        vo.setName(col.getName());
        vo.setDescription(col.getDescription());
        vo.setCoverImage(col.getCoverImage());
        List<ArticleTitleRef> articles = collectionArticleMapper.findArticlesByCollectionIdOrdered(id);
        vo.setArticles(articles != null ? articles : new ArrayList<>());
        return vo;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
