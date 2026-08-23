package com.ims.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Project;
import com.ims.entity.ProjectTag;
import com.ims.entity.Tag;
import com.ims.mapper.ProjectMapper;
import com.ims.mapper.ProjectTagMapper;
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
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private ProjectMapper projectMapper;

    @Autowired
    private ProjectTagMapper projectTagMapper;

    @Autowired
    private TagMapper tagMapper;

    @Autowired
    private AssetService assetService;

    public PageBean<Project> findPage(PageQuery query) {
        PageBean<Project> pageBean = new PageBean<>();
        String sortField = SortUtil.safeField(query.getSortField());
        String sortOrder = SortUtil.safeOrder(query.getSortOrder());

        long total = projectMapper.count();
        int offset = (query.getPage() - 1) * query.getSize();
        List<Project> list = projectMapper.findPage(offset, query.getSize(), sortField, sortOrder);
        populateTags(list);

        pageBean.setTotal(total);
        pageBean.setPage(query.getPage());
        pageBean.setSize(query.getSize());
        pageBean.setList(list);
        return pageBean;
    }

    public List<Project> findAll() {
        List<Project> list = projectMapper.findAll();
        populateTags(list);
        return list;
    }

    public Project findById(Integer id) {
        return populateTags(projectMapper.findById(id));
    }

    @Transactional
    public boolean save(Project project) {
        if (project == null || project.getTitle() == null || project.getTitle().isBlank()) {
            return false;
        }
        boolean success;
        if (project.getId() == null) {
            success = projectMapper.insert(project) > 0;
        } else {
            success = projectMapper.update(project) > 0;
        }
        if (!success) {
            return false;
        }
        saveProjectTags(project.getId(), project.getTagIds());
        return true;
    }

    @Transactional
    public boolean delete(Integer id) {
        Project project = projectMapper.findById(id);
        List<String> keys = parseImageKeys(project != null ? project.getImageKeys() : null);
        projectTagMapper.deleteByProjectId(id);
        boolean ok = projectMapper.deleteById(id) > 0;
        // COS 删除放在事务提交后执行，避免长事务锁；失败由 AssetService 落孤儿兜底
        if (!keys.isEmpty()) {
            List<String> finalKeys = keys;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        assetService.delete(finalKeys);
                    } catch (Exception e) {
                        log.warn("级联删除项目 COS 资源失败: projectId={}", id, e);
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

    private Project populateTags(Project project) {
        if (project == null) {
            return null;
        }
        populateTags(List.of(project));
        return project;
    }

    private void populateTags(List<Project> projects) {
        if (projects == null || projects.isEmpty()) {
            return;
        }
        List<Integer> projectIds = projects.stream()
                .map(Project::getId)
                .distinct()
                .collect(Collectors.toList());

        List<ProjectTag> projectTags = projectTagMapper.findByProjectIds(projectIds);
        List<Integer> tagIds = projectTags.stream()
                .map(ProjectTag::getTagId)
                .distinct()
                .collect(Collectors.toList());

        Map<Integer, String> tagNameMap;
        if (tagIds.isEmpty()) {
            tagNameMap = new HashMap<>();
        } else {
            tagNameMap = tagMapper.findByIds(tagIds).stream()
                    .collect(Collectors.toMap(Tag::getId, Tag::getName, (a, b) -> a));
        }

        Map<Integer, List<Integer>> projectTagIdMap = projectTags.stream()
                .collect(Collectors.groupingBy(ProjectTag::getProjectId,
                        Collectors.mapping(ProjectTag::getTagId, Collectors.toList())));

        for (Project project : projects) {
            List<Integer> ids = projectTagIdMap.getOrDefault(project.getId(), new ArrayList<>());
            project.setTagIds(ids);
            List<String> names = new ArrayList<>();
            for (Integer tagId : ids) {
                String name = tagNameMap.get(tagId);
                if (name != null) {
                    names.add(name);
                }
            }
            project.setTagNames(names);
        }
    }

    private void saveProjectTags(Integer projectId, List<Integer> tagIds) {
        if (projectId == null) {
            return;
        }
        projectTagMapper.deleteByProjectId(projectId);
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        for (Integer tagId : tagIds) {
            if (tagId == null) {
                continue;
            }
            ProjectTag pt = new ProjectTag();
            pt.setProjectId(projectId);
            pt.setTagId(tagId);
            projectTagMapper.insert(pt);
        }
    }
}
