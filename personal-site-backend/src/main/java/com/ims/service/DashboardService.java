package com.ims.service;

import com.ims.mapper.ArticleMapper;
import com.ims.mapper.ProjectMapper;
import com.ims.mapper.SkillMapper;
import com.ims.mapper.TagMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class DashboardService {

    @Autowired
    private ArticleMapper articleMapper;

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private SkillMapper skillMapper;

    @Autowired
    private TagMapper tagMapper;

    public Map<String, Object> stats() {
        Map<String, Object> map = new HashMap<>();
        map.put("articleCount", articleMapper.count(null, null));
        map.put("projectCount", projectMapper.count());
        map.put("skillCount", skillMapper.count());
        map.put("tagCount", tagMapper.countAll());
        map.put("totalViews", articleMapper.sumViewCount());
        map.put("totalLikes", articleMapper.sumLikeCount());
        return map;
    }
}
