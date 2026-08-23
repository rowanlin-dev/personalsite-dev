package com.ims.mapper;

import com.ims.entity.AssetOrphan;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface AssetOrphanMapper {

    int insert(AssetOrphan orphan);

    List<AssetOrphan> findAll();

    int deleteById(@Param("id") Long id);
}
