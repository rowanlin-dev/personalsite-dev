package com.ims.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * 自定义 ObjectMapper，注册 Java 8 日期时间模块
 */
public class CustomObjectMapper extends ObjectMapper {

    public CustomObjectMapper() {
        super();
        // 支持 JDK8 日期时间类型（LocalDateTime 等）
        registerModule(new JavaTimeModule());
    }
}
