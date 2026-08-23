package com.ims.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ims.entity.Article;
import com.ims.entity.PageBean;
import com.ims.entity.Project;
import com.ims.service.ArticleService;
import com.ims.service.ProjectService;
import com.ims.service.SiteConfigService;
import com.ims.service.TagService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * 首页核心接口性能测试。
 *
 * 通过 MockMvc + Mockito 消除网络和数据库影响，测量 Controller + 序列化层本身的响应时间。
 * 若平均值超过阈值，说明业务层或序列化存在耗时问题。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HomeApiPerformanceTest {

    private static final int WARMUP = 10;
    private static final int ITERATIONS = 100;
    // 阈值（ms）：纯 Controller + Service(mock) + JSON 序列化，理应远低于此值
    private static final long THRESHOLD_MS = 50;

    private MockMvc mockMvc;

    @Mock
    private ArticleService articleService;
    @Mock
    private ProjectService projectService;
    @Mock
    private SiteConfigService siteConfigService;
    @Mock
    private TagService tagService;

    @InjectMocks
    private ArticleController articleController;
    @InjectMocks
    private ProjectController projectController;
    @InjectMocks
    private SiteConfigController siteConfigController;
    @InjectMocks
    private TagController tagController;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                articleController,
                projectController,
                siteConfigController,
                tagController
        ).build();

        // 模拟首页文章列表（5 条，带标签）
        List<Article> articles = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            Article a = new Article();
            a.setId(i);
            a.setTitle("文章 " + i);
            a.setMdContent("# 正文".repeat(20));
            a.setViewCount(i * 10);
            a.setLikeCount(i);
            a.setCreateTime(LocalDateTime.now());
            a.setTagNames(List.of("Java", "Vue"));
            articles.add(a);
        }
        PageBean<Article> pageBean = new PageBean<>();
        pageBean.setTotal(5L);
        pageBean.setPage(1);
        pageBean.setSize(5);
        pageBean.setList(articles);
        when(articleService.findPage(any(), eq(null), eq(null))).thenReturn(pageBean);

        // 模拟项目列表（6 条，带标签）
        List<Project> projects = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            Project p = new Project();
            p.setId(i);
            p.setTitle("项目 " + i);
            p.setDescript("项目描述");
            p.setTagNames(List.of("Spring", "MySQL"));
            projects.add(p);
        }
        when(projectService.findAll()).thenReturn(projects);

        // 模拟站点配置
        Map<String, String> config = new HashMap<>();
        config.put("about_title", "标题");
        config.put("about_content", "内容");
        config.put("contact_email", "a@b.com");
        config.put("contact_github", "https://github.com/test");
        config.put("contact_wechat", "");
        config.put("resume_enable", "1");
        config.put("resume_pdf", "https://example.com/resume.pdf");
        config.put("avatar_url", "");
        config.put("avatar_show", "1");
        when(siteConfigService.findAll()).thenReturn(config);

        // 模拟技术栈图谱
        List<Map<String, Object>> techMap = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            Map<String, Object> node = new HashMap<>();
            node.put("id", i);
            node.put("name", "技术 " + i);
            node.put("level", i * 10);
            node.put("article_count", i);
            techMap.add(node);
        }
        when(tagService.findTechMapData()).thenReturn(techMap);
    }

    @Test
    void homeApisShouldRespondFast() throws Exception {
        // 预热，避免首次初始化带来的偏差
        for (int i = 0; i < WARMUP; i++) {
            callHomeApis();
        }

        long total = 0;
        long max = 0;
        for (int i = 0; i < ITERATIONS; i++) {
            long start = System.nanoTime();
            callHomeApis();
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            total += durationMs;
            if (durationMs > max) {
                max = durationMs;
            }
        }

        long avg = total / ITERATIONS;
        System.out.printf("首页 4 个接口串行总耗时：平均 %d ms，最大 %d ms（%d 次迭代）%n", avg, max, ITERATIONS);

        if (avg > THRESHOLD_MS) {
            throw new AssertionError("首页接口平均耗时过高：" + avg + " ms，阈值：" + THRESHOLD_MS + " ms");
        }
    }

    private void callHomeApis() throws Exception {
        mockMvc.perform(get("/api/article/list").param("page", "1").param("size", "5"));
        mockMvc.perform(get("/api/project/all"));
        mockMvc.perform(get("/api/tag/tech-map"));
        mockMvc.perform(get("/api/config/all"));
    }

    @Test
    void articleListShouldNotReturnFullContent() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/article/list").param("page", "1").param("size", "5"))
                .andReturn();
        String json = result.getResponse().getContentAsString();
        // 确认返回字段中不包含完整长正文（即不应有超过 500 字符的 mdContent）
        Map<?, ?> map = objectMapper.readValue(json, Map.class);
        List<?> list = (List<?>) ((Map<?, ?>) map.get("data")).get("list");
        for (Object item : list) {
            String mdContent = (String) ((Map<?, ?>) item).get("mdContent");
            if (mdContent != null && mdContent.length() > 500) {
                throw new AssertionError("文章列表返回了过长的 mdContent：" + mdContent.length() + " 字符");
            }
        }
    }
}
