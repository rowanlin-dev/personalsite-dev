package com.ims.service;

import com.ims.entity.Tag;
import com.ims.entity.TagAlias;
import com.ims.mapper.ArticleTagMapper;
import com.ims.mapper.ProjectTagMapper;
import com.ims.mapper.SkillMapper;
import com.ims.mapper.TagAliasMapper;
import com.ims.mapper.TagMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class TagService {

    @Autowired
    private TagMapper tagMapper;

    @Autowired
    private TagAliasMapper tagAliasMapper;

    @Autowired
    private SkillMapper skillMapper;

    @Autowired
    private ArticleTagMapper articleTagMapper;

    @Autowired
    private ProjectTagMapper projectTagMapper;

    public List<Tag> findAll() {
        return tagMapper.findAll();
    }

    public List<Tag> findAllWithAliases() {
        List<Tag> tags = tagMapper.findAllWithAliases();
        for (Tag tag : tags) {
            if (tag.getAliases() != null) {
                tag.setAliases(tag.getAliases().stream()
                        .filter(a -> a.getId() != null && a.getAliasName() != null && !a.getAliasName().isBlank())
                        .collect(Collectors.toList()));
            }
        }
        return tags;
    }

    public List<Tag> findTree() {
        return tagMapper.findTree();
    }

    public Tag findById(Integer id) {
        return tagMapper.findById(id);
    }

    public List<Tag> searchByName(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return tagMapper.findAll();
        }
        return tagMapper.searchByName(keyword.trim());
    }

    public List<Map<String, Object>> findTagCloud() {
        return tagMapper.findTagCloud();
    }

    public List<TagAlias> findAliasesByTagId(Integer tagId) {
        return tagAliasMapper.findByTagId(tagId);
    }

    @Transactional
    public boolean saveTag(Tag tag) {
        if (tag == null || tag.getName() == null || tag.getName().isBlank()) {
            return false;
        }
        String name = tag.getName().trim();
        tag.setName(name);

        // 名称唯一性校验（不能与现有标签名或别名冲突）
        if (tag.getId() == null) {
            if (tagMapper.countByName(name) > 0 || tagAliasMapper.countByAliasName(name) > 0) {
                return false;
            }
        } else {
            if (tagMapper.countByNameExcludingId(name, tag.getId()) > 0 || tagAliasMapper.countByAliasName(name) > 0) {
                return false;
            }
        }

        // 父标签不能是自己，且不能形成循环
        if (tag.getParentId() != null) {
            if (tag.getParentId().equals(tag.getId())) {
                return false;
            }
            if (tag.getId() != null && isAncestor(tag.getId(), tag.getParentId())) {
                return false;
            }
        }

        if (tag.getIsTechStack() == null) {
            tag.setIsTechStack(true);
        }
        if (tag.getShowInTechMap() == null) {
            tag.setShowInTechMap(true);
        }

        if (tag.getId() == null) {
            return tagMapper.insert(tag) > 0;
        }
        return tagMapper.update(tag) > 0;
    }

    @Transactional
    public boolean deleteTag(Integer id) {
        if (id == null) {
            return false;
        }
        // 有子标签时不允许删除
        if (tagMapper.countByParentId(id) > 0) {
            return false;
        }
        // 有关联技能、文章、项目时不允许删除
        if (skillMapper.countByTagId(id) > 0) {
            return false;
        }
        if (articleTagMapper.countByTagId(id) > 0) {
            return false;
        }
        if (projectTagMapper.countByTagId(id) > 0) {
            return false;
        }
        // 删除别名
        tagAliasMapper.deleteByTagId(id);
        return tagMapper.deleteById(id) > 0;
    }

    @Transactional
    public boolean saveAlias(TagAlias alias) {
        if (alias == null || alias.getAliasName() == null || alias.getAliasName().isBlank()) {
            return false;
        }
        String aliasName = alias.getAliasName().trim();
        alias.setAliasName(aliasName);

        // 别名不能与任何 tag.name 冲突
        if (tagMapper.countByName(aliasName) > 0) {
            return false;
        }

        // 别名唯一性校验
        if (alias.getId() == null) {
            if (tagAliasMapper.countByAliasName(aliasName) > 0) {
                return false;
            }
        } else {
            if (tagAliasMapper.countByAliasNameExcludingId(aliasName, alias.getId()) > 0) {
                return false;
            }
        }

        if (alias.getId() == null) {
            return tagAliasMapper.insert(alias) > 0;
        }
        return tagAliasMapper.update(alias) > 0;
    }

    @Transactional
    public boolean deleteAlias(Integer id) {
        return id != null && tagAliasMapper.deleteById(id) > 0;
    }

    /**
     * 检查 ancestorId 是否是 descendantId 的祖先（用于防止循环父标签）
     */
    private boolean isAncestor(Integer descendantId, Integer ancestorId) {
        Set<Integer> visited = new HashSet<>();
        Integer current = ancestorId;
        while (current != null) {
            if (current.equals(descendantId)) {
                return true;
            }
            if (!visited.add(current)) {
                break; // 已有循环，防御性退出
            }
            Tag parent = tagMapper.findById(current);
            current = parent == null ? null : parent.getParentId();
        }
        return false;
    }

    /**
     * 获取技术栈图谱数据：每个标签带熟练度与文章引用次数
     */
    public List<Map<String, Object>> findTechMapData() {
        return tagMapper.findTagStats();
    }
}
