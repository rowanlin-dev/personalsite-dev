package com.ims.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 腾讯云 CDN best-effort 刷新工具（no-op stub）。
 *
 * 说明：腾讯云 CDN SDK（com.tencentcloudapi:tencentcloud-sdk-java-cdn）在当前离线构建环境
 * 无法解析（本地仓库不含该依赖、且无法联网下载），按构建保绿规则改为 no-op 实现：
 * 删除流程不再依赖 CDN 刷新，仅打印 warn 日志并返回 false，删除绝不会因 CDN 失败而中断。
 *
 * 如需启用真实刷新，取消 pom.xml 中注释的 tencentcloud-sdk-java-cdn 依赖，并将本类替换为
 * 真实实现（CdnClient + PurgeUrlsCache / PurgePathCache，所有调用 try/catch 吞异常）。
 */
@Component
public class CdnUtil {

    private static final Logger log = LoggerFactory.getLogger(CdnUtil.class);

    public boolean purgeUrlsCache(List<String> urls) {
        log.warn("CDN purge skipped; relying on content-hash naming");
        return false;
    }

    public boolean purgePathCache(List<String> paths) {
        log.warn("CDN purge skipped; relying on content-hash naming");
        return false;
    }
}
