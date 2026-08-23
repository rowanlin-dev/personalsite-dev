package com.ims.mapper;

import com.ims.entity.SiteConfig;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface SiteConfigMapper {

    List<SiteConfig> findAll();

    SiteConfig findByKey(@Param("key") String key);

    int insert(SiteConfig config);

    int update(SiteConfig config);
}
