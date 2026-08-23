package com.ims.util;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 排序字段白名单工具，防止 SQL 注入
 */
public class SortUtil {

    private static final Set<String> ALLOWED_FIELDS = new HashSet<>(Arrays.asList(
            "id", "title", "name", "level", "category", "create_time", "view_count", "like_count"
    ));

    private static final Set<String> ALLOWED_ORDERS = new HashSet<>(Arrays.asList("asc", "desc"));

    public static String safeField(String field) {
        if (field == null || !ALLOWED_FIELDS.contains(field.toLowerCase())) {
            return "id";
        }
        return field;
    }

    public static String safeOrder(String order) {
        if (order == null || !ALLOWED_ORDERS.contains(order.toLowerCase())) {
            return "asc";
        }
        return order;
    }
}
