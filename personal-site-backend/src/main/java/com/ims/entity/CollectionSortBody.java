package com.ims.entity;

import java.util.List;

/**
 * 合集内文章排序请求体：{ "orderedArticleIds": [3, 1, 2] }
 */
public class CollectionSortBody {
    private List<Integer> orderedArticleIds;

    public List<Integer> getOrderedArticleIds() {
        return orderedArticleIds;
    }

    public void setOrderedArticleIds(List<Integer> orderedArticleIds) {
        this.orderedArticleIds = orderedArticleIds;
    }
}
