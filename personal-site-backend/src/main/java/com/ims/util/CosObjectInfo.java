package com.ims.util;

/**
 * COS 对象元信息（去 SDK 耦合，供 Service 组装列表响应）。
 * lastModified 为 epoch 毫秒。
 */
public record CosObjectInfo(String key, long size, long lastModified) {
}
