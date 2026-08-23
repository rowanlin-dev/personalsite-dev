package com.ims.service;

import com.ims.entity.Article;
import com.ims.entity.ArticleTag;
import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Tag;
import com.ims.mapper.ArticleMapper;
import com.ims.mapper.ArticleTagMapper;
import com.ims.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 验证文章列表批量填充标签时，不会出现 N+1 查询。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ArticleServiceQueryCountTest {

    @Mock
    private ArticleMapper articleMapper;
    @Mock
    private ArticleTagMapper articleTagMapper;
    @Mock
    private TagMapper tagMapper;

    @InjectMocks
    private ArticleService articleService;

    @BeforeEach
    void setUp() {
        Article a1 = new Article();
        a1.setId(1);
        a1.setTitle("A1");
        Article a2 = new Article();
        a2.setId(2);
        a2.setTitle("A2");
        Article a3 = new Article();
        a3.setId(3);
        a3.setTitle("A3");

        when(articleMapper.count(null, null)).thenReturn(3L);
        when(articleMapper.findPage(0, 10, "id", "asc", null, null))
                .thenReturn(List.of(a1, a2, a3));

        ArticleTag at1 = new ArticleTag();
        at1.setArticleId(1);
        at1.setTagId(10);
        ArticleTag at2 = new ArticleTag();
        at2.setArticleId(2);
        at2.setTagId(10);
        ArticleTag at3 = new ArticleTag();
        at3.setArticleId(3);
        at3.setTagId(20);

        when(articleTagMapper.findByArticleIds(anyList()))
                .thenReturn(List.of(at1, at2, at3));

        Tag t1 = new Tag();
        t1.setId(10);
        t1.setName("Java");
        Tag t2 = new Tag();
        t2.setId(20);
        t2.setName("Vue");

        when(tagMapper.findByIds(anyList())).thenReturn(List.of(t1, t2));
    }

    @Test
    void findPageShouldUseBatchTagQuery() {
        PageQuery query = new PageQuery();
        query.setPage(1);
        query.setSize(10);

        PageBean<Article> page = articleService.findPage(query, null, null);

        assertEquals(3, page.getList().size());

        // 关键断言：批量查询各只调用一次，而不是每篇文章一次
        verify(articleTagMapper, times(1)).findByArticleIds(anyList());
        verify(articleTagMapper, times(0)).findByArticleId(anyInt());
        verify(tagMapper, times(1)).findByIds(anyList());
        verify(tagMapper, times(0)).findById(anyInt());
    }
}
