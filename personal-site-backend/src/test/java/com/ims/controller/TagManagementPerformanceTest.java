package com.ims.controller;

import com.ims.entity.Tag;
import com.ims.entity.TagAlias;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * 后台「标签管理」页面接口性能测试。
 *
 * 旧实现需要 1 次 /tag/list + N 次 /tag/alias 串行请求，存在明显 N+1 延迟。
 * 新实现应只需 1 次 /tag/list-with-aliases。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TagManagementPerformanceTest {

    private static final int WARMUP = 10;
    private static final int ITERATIONS = 100;
    private static final long THRESHOLD_MS = 50;

    private MockMvc mockMvc;

    @Mock
    private TagService tagService;

    @InjectMocks
    private TagController tagController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(tagController).build();

        List<Tag> tags = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            Tag tag = new Tag();
            tag.setId(i);
            tag.setName("标签 " + i);
            tag.setParentId(i <= 5 ? null : (i % 5 + 1));
            tag.setIsTechStack(true);
            tag.setShowInTechMap(true);
            tag.setDescription("描述");

            List<TagAlias> aliases = new ArrayList<>();
            aliases.add(createAlias(i * 100, i, "AliasA"));
            aliases.add(createAlias(i * 100 + 1, i, "AliasB"));
            tag.setAliases(aliases);

            tags.add(tag);
        }

        when(tagService.findAllWithAliases()).thenReturn(tags);
    }

    private TagAlias createAlias(Integer id, Integer tagId, String name) {
        TagAlias alias = new TagAlias();
        alias.setId(id);
        alias.setTagId(tagId);
        alias.setAliasName(name + tagId);
        return alias;
    }

    @Test
    void tagListWithAliasesShouldRespondFast() throws Exception {
        for (int i = 0; i < WARMUP; i++) {
            mockMvc.perform(get("/api/tag/list-with-aliases"));
        }

        long total = 0;
        long max = 0;
        for (int i = 0; i < ITERATIONS; i++) {
            long start = System.nanoTime();
            mockMvc.perform(get("/api/tag/list-with-aliases"));
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            total += durationMs;
            if (durationMs > max) {
                max = durationMs;
            }
        }

        long avg = total / ITERATIONS;
        System.out.printf("/api/tag/list-with-aliases 耗时：平均 %d ms，最大 %d ms（%d 次迭代）%n", avg, max, ITERATIONS);

        if (avg > THRESHOLD_MS) {
            throw new AssertionError("标签管理接口平均耗时过高：" + avg + " ms，阈值：" + THRESHOLD_MS + " ms");
        }
    }

    @Test
    void tagListWithAliasesShouldCallServiceOnlyOnce() throws Exception {
        mockMvc.perform(get("/api/tag/list-with-aliases"));
        verify(tagService, times(1)).findAllWithAliases();
    }
}
