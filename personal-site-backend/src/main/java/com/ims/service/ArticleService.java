package com.ims.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ims.entity.Article;
import com.ims.entity.ArticleCollectionLink;
import com.ims.entity.ArticleTag;
import com.ims.entity.CollectionRef;
import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Tag;
import com.ims.mapper.ArticleMapper;
import com.ims.mapper.ArticleTagMapper;
import com.ims.mapper.CollectionArticleMapper;
import com.ims.mapper.TagMapper;
import com.ims.util.SortUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ArticleService {

    private static final Logger log = LoggerFactory.getLogger(ArticleService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private ArticleMapper articleMapper;

    @Autowired
    private ArticleTagMapper articleTagMapper;

    @Autowired
    private TagMapper tagMapper;

    @Autowired
    private CollectionArticleMapper collectionArticleMapper;

    @Autowired
    private AssetService assetService;

    public PageBean<Article> findPage(PageQuery query, String titleKey, String tagKey) {
        PageBean<Article> pageBean = new PageBean<>();
        String sortField = SortUtil.safeField(query.getSortField());
        String sortOrder = SortUtil.safeOrder(query.getSortOrder());

        long total = articleMapper.count(titleKey, tagKey);
        int offset = (query.getPage() - 1) * query.getSize();
        List<Article> list = articleMapper.findPage(offset, query.getSize(), sortField, sortOrder, titleKey, tagKey);
        populateTags(list);
        populateCollections(list);

        pageBean.setTotal(total);
        pageBean.setPage(query.getPage());
        pageBean.setSize(query.getSize());
        pageBean.setList(list);
        return pageBean;
    }

    @Transactional
    public Article getDetail(Integer id) {
        // 注意：阅读量计数不再在此处无条件自增，改由 controller 做
        // 「会话去重 + IP 冷却」防护后显式调用 increaseViewCount(id)，
        // 否则公开接口会被任意刷新/爬虫无限刷高（详见 ArticleController.detail）。
        Article article = populateTags(articleMapper.findById(id));
        populateCollections(article);
        return article;
    }

    /**
     * 阅读量 +1，仅在校验通过（同一会话/冷却期内未重复计数）后由 controller 调用。
     *
     * 单独拆出来是为了把「是否计数」的去重决策留在 controller 层，
     * 与 articleService 的纯查询/写操作职责分离。
     */
    @Transactional
    public void increaseViewCount(Integer id) {
        articleMapper.increaseViewCount(id);
    }

    public Article findById(Integer id) {
        Article article = populateTags(articleMapper.findById(id));
        populateCollections(article);
        return article;
    }

    @Transactional
    public Article save(Article article) {
        if (article == null || article.getTitle() == null || article.getTitle().isBlank()) {
            return null;
        }
        boolean success;
        if (article.getId() == null) {
            success = articleMapper.insert(article) > 0;
        } else {
            success = articleMapper.update(article) > 0;
        }
        if (!success) {
            return null;
        }
        // 保存标签关联
        saveArticleTags(article.getId(), article.getTagIds());
        return article;
    }

    @Transactional
    public boolean delete(Integer id) {
        Article article = articleMapper.findById(id);
        List<String> keys = parseImageKeys(article != null ? article.getImageKeys() : null);
        articleTagMapper.deleteByArticleId(id);
        boolean ok = articleMapper.deleteById(id) > 0;
        // COS 删除放在事务提交后执行，避免长事务锁；失败由 AssetService 落孤儿兜底
        if (!keys.isEmpty()) {
            List<String> finalKeys = keys;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        assetService.delete(finalKeys);
                    } catch (Exception e) {
                        log.warn("级联删除文章 COS 资源失败: articleId={}", id, e);
                    }
                }
            });
        }
        return ok;
    }

    /**
     * 解析 image_keys JSON 数组为 key 列表；解析失败返回空列表。
     */
    private List<String> parseImageKeys(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<?> list = objectMapper.readValue(json, List.class);
            List<String> keys = new ArrayList<>();
            for (Object o : list) {
                if (o != null) {
                    keys.add(o.toString());
                }
            }
            return keys;
        } catch (Exception e) {
            log.warn("解析 imageKeys 失败: {}", json, e);
            return List.of();
        }
    }

    @Transactional
    public boolean like(Integer id) {
        return articleMapper.increaseLikeCount(id) > 0;
    }

    private Article populateTags(Article article) {
        if (article == null) {
            return null;
        }
        populateTags(List.of(article));
        return article;
    }

    private void populateTags(List<Article> articles) {
        if (articles == null || articles.isEmpty()) {
            return;
        }
        List<Integer> articleIds = articles.stream()
                .map(Article::getId)
                .distinct()
                .collect(Collectors.toList());

        List<ArticleTag> articleTags = articleTagMapper.findByArticleIds(articleIds);
        List<Integer> tagIds = articleTags.stream()
                .map(ArticleTag::getTagId)
                .distinct()
                .collect(Collectors.toList());

        Map<Integer, String> tagNameMap;
        if (tagIds.isEmpty()) {
            tagNameMap = new HashMap<>();
        } else {
            tagNameMap = tagMapper.findByIds(tagIds).stream()
                    .collect(Collectors.toMap(Tag::getId, Tag::getName, (a, b) -> a));
        }

        Map<Integer, List<Integer>> articleTagIdMap = articleTags.stream()
                .collect(Collectors.groupingBy(ArticleTag::getArticleId,
                        Collectors.mapping(ArticleTag::getTagId, Collectors.toList())));

        for (Article article : articles) {
            List<Integer> ids = articleTagIdMap.getOrDefault(article.getId(), new ArrayList<>());
            article.setTagIds(ids);
            List<String> names = new ArrayList<>();
            for (Integer tagId : ids) {
                String name = tagNameMap.get(tagId);
                if (name != null) {
                    names.add(name);
                }
            }
            article.setTagNames(names);
        }
    }

    private void populateCollections(Article article) {
        if (article == null) {
            return;
        }
        populateCollections(List.of(article));
    }

    /**
     * 批量填充文章所属【公开】合集（CollectionRef={id,name}）。
     * 必须为批量 IN 查询，禁止 N+1（镜像 populateTags）：
     * 一次查出所有文章→公开合集的链接，再按 articleId 分组回填。
     */
    private void populateCollections(List<Article> articles) {
        if (articles == null || articles.isEmpty()) {
            return;
        }
        List<Integer> articleIds = articles.stream()
                .map(Article::getId)
                .distinct()
                .collect(Collectors.toList());

        List<ArticleCollectionLink> links = collectionArticleMapper.findPublicByArticleIds(articleIds);

        Map<Integer, List<CollectionRef>> map = new HashMap<>();
        for (ArticleCollectionLink link : links) {
            map.computeIfAbsent(link.getArticleId(), k -> new ArrayList<>())
                    .add(new CollectionRef(link.getCollectionId(), link.getName()));
        }

        for (Article article : articles) {
            article.setCollections(map.getOrDefault(article.getId(), new ArrayList<>()));
        }
    }

    private void saveArticleTags(Integer articleId, List<Integer> tagIds) {
        if (articleId == null) {
            return;
        }
        articleTagMapper.deleteByArticleId(articleId);
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        for (Integer tagId : tagIds) {
            if (tagId == null) {
                continue;
            }
            ArticleTag at = new ArticleTag();
            at.setArticleId(articleId);
            at.setTagId(tagId);
            articleTagMapper.insert(at);
        }
    }
}
