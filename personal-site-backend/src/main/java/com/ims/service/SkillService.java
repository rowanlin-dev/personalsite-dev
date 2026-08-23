package com.ims.service;

import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Skill;
import com.ims.entity.Tag;
import com.ims.mapper.SkillMapper;
import com.ims.mapper.TagMapper;
import com.ims.util.SortUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SkillService {

    @Autowired
    private SkillMapper skillMapper;

    @Autowired
    private TagMapper tagMapper;

    public PageBean<Skill> findPage(PageQuery query) {
        PageBean<Skill> pageBean = new PageBean<>();
        String sortField = SortUtil.safeField(query.getSortField());
        String sortOrder = SortUtil.safeOrder(query.getSortOrder());

        long total = skillMapper.count();
        int offset = (query.getPage() - 1) * query.getSize();
        List<Skill> list = skillMapper.findPage(offset, query.getSize(), sortField, sortOrder);

        pageBean.setTotal(total);
        pageBean.setPage(query.getPage());
        pageBean.setSize(query.getSize());
        pageBean.setList(list);
        return pageBean;
    }

    public List<Skill> findAll() {
        return skillMapper.findAll();
    }

    public Skill findById(Integer id) {
        return skillMapper.findById(id);
    }

    @Transactional
    public boolean save(Skill skill) {
        if (skill == null || skill.getTagName() == null || skill.getTagName().isBlank()) {
            return false;
        }
        if (skill.getLevel() == null) {
            skill.setLevel(0);
        }
        if (skill.getIsTechStack() == null) {
            skill.setIsTechStack(true);
        }
        if (skill.getShowInTechMap() == null) {
            skill.setShowInTechMap(true);
        }

        Tag tag;
        if (skill.getTagId() == null) {
            // 新增技能：按名称查找或创建对应标签
            String name = skill.getTagName().trim();
            tag = tagMapper.findByName(name);
            if (tag != null) {
                // 该标签已有关联技能时不允许重复创建（明确报错，而非静默失败）
                if (skillMapper.countByTagId(tag.getId()) > 0) {
                    throw new IllegalArgumentException("标签「" + name + "」已关联技能，请勿重复创建");
                }
            } else {
                tag = new Tag();
                tag.setName(name);
                tag.setParentId(skill.getParentId());
                tag.setIsTechStack(skill.getIsTechStack());
                tag.setShowInTechMap(skill.getShowInTechMap());
                if (!validateTag(tag, null)) {
                    throw new IllegalArgumentException("标签名称校验失败（可能与其他标签重名）");
                }
                tagMapper.insert(tag);
            }
            skill.setTagId(tag.getId());
        } else {
            tag = tagMapper.findById(skill.getTagId());
            if (tag == null) {
                throw new IllegalArgumentException("关联的标签不存在（tagId=" + skill.getTagId() + "）");
            }
            // 同步更新标签属性
            if (skill.getTagName() != null && !skill.getTagName().isBlank()) {
                tag.setName(skill.getTagName().trim());
            }
            tag.setParentId(skill.getParentId());
            tag.setIsTechStack(skill.getIsTechStack());
            tag.setShowInTechMap(skill.getShowInTechMap());
            // 父标签不能是自己或自己的后代（防止分类树成环）
            // 即：tagId 不能是 proposedParent 的祖先（否则形成 A→B→...→A 环）
            if (tag.getParentId() != null && tag.getParentId().equals(tag.getId())) {
                throw new IllegalArgumentException("父标签不能选择自身");
            }
            if (tag.getParentId() != null && wouldFormCycle(tag.getId(), tag.getParentId())) {
                throw new IllegalArgumentException("父标签不能选择自身或其子分类（会形成环）");
            }
            // 编辑时跳过自身名称的唯一性校验，仅阻止与其他标签重名
            if (!validateTag(tag, tag.getId())) {
                throw new IllegalArgumentException("标签名称「" + tag.getName() + "」与其他标签重名");
            }
            tagMapper.update(tag);
        }

        if (skill.getId() == null) {
            return skillMapper.insert(skill) > 0;
        }
        return skillMapper.update(skill) > 0;
    }

    /**
     * 将已有标签直接转换为技能（标签管理页「添加到技能」按钮使用）。
     * 保留标签的共用属性（名称/父类/技术栈/图谱展示），熟练度由调用方设置。
     * 若该标签已关联技能则抛异常，避免重复。
     */
    @Transactional
    public boolean createFromTag(Integer tagId, Integer level) {
        if (tagId == null) {
            throw new IllegalArgumentException("tagId 不能为空");
        }
        Tag tag = tagMapper.findById(tagId);
        if (tag == null) {
            throw new IllegalArgumentException("标签不存在（tagId=" + tagId + "）");
        }
        if (skillMapper.countByTagId(tagId) > 0) {
            throw new IllegalArgumentException("标签「" + tag.getName() + "」已关联技能");
        }
        Skill skill = new Skill();
        skill.setTagId(tagId);
        skill.setLevel(level == null ? 0 : level);
        // 技能创建后，确保标签的技术栈/图谱展示属性同步打开
        tag.setIsTechStack(true);
        tag.setShowInTechMap(true);
        tagMapper.update(tag);
        return skillMapper.insert(skill) > 0;
    }

    private boolean validateTag(Tag tag, Integer excludeId) {
        if (tag.getName() == null || tag.getName().isBlank()) {
            return false;
        }
        // 名称唯一性（编辑时排除自身）
        Integer exId = excludeId != null ? excludeId : (tag.getId() != null ? tag.getId() : -1);
        if (tagMapper.countByNameExcludingId(tag.getName(), exId) > 0) {
            return false;
        }
        return true;
    }

    /**
     * 检查将 proposedParent 设为 tagId 的父标签是否会形成环。
     * 正确逻辑：从 proposedParent 向上遍历到根，如果途中遇到 tagId，
     * 说明 tagId 已经是 proposedParent 的祖先 → 设为父子会形成环。
     *
     * 旧 isAncestor 方法有 bug：从 ancestorId 向上走，会把正常父子关系误判为环。
     * 例如 minprogram(id=18,parent=1)：从 18 向上走到 1，发现 1==descendantId(1) → 误报。
     */
    private boolean wouldFormCycle(Integer tagId, Integer proposedParent) {
        Set<Integer> visited = new HashSet<>();
        Integer current = proposedParent;  // 从拟设的父标签向上走到根
        while (current != null) {
            if (current.equals(tagId)) {
                return true;  // 在 proposedParent 的祖先链中找到了 tagId → 会成环
            }
            if (!visited.add(current)) {
                break;  // 防止已有环数据导致死循环
            }
            Tag node = tagMapper.findById(current);
            current = node == null ? null : node.getParentId();
        }
        return false;
    }

    @Transactional
    public boolean delete(Integer id) {
        return skillMapper.deleteById(id) > 0;
    }

    /**
     * 雷达图数据
     */
    public Map<String, Object> radarData() {
        List<Skill> list = skillMapper.findAll();
        Map<String, Object> result = new HashMap<>();
        result.put("indicator", list.stream().map(s -> Map.of("name", s.getTagName())).toList());
        result.put("data", List.of(list.stream().map(Skill::getLevel).toList()));
        return result;
    }
}
