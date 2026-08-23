package com.ims.service;

import com.ims.entity.SiteConfig;
import com.ims.mapper.SiteConfigMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SiteConfigService {

    @Autowired
    private SiteConfigMapper siteConfigMapper;

    /**
     * 全量配置缓存。配置项少量且变更不频繁，内存缓存可避免每次按 key 查库。
     */
    private final Map<String, String> configCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadCache() {
        reloadCache();
    }

    private synchronized void reloadCache() {
        List<SiteConfig> list = siteConfigMapper.findAll();
        Map<String, String> map = new HashMap<>(list.size());
        for (SiteConfig config : list) {
            map.put(config.getKey(), config.getValue());
        }
        configCache.clear();
        configCache.putAll(map);
    }

    public Map<String, String> findAll() {
        return new HashMap<>(configCache);
    }

    public String getValue(String key) {
        return configCache.get(key);
    }

    @Transactional
    public boolean save(String key, String value) {
        SiteConfig config = siteConfigMapper.findByKey(key);
        boolean success;
        if (config == null) {
            SiteConfig c = new SiteConfig();
            c.setKey(key);
            c.setValue(value);
            success = siteConfigMapper.insert(c) > 0;
        } else {
            config.setValue(value);
            success = siteConfigMapper.update(config) > 0;
        }
        if (success) {
            configCache.put(key, value);
        }
        return success;
    }
}
