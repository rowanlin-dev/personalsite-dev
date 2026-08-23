package com.ims.entity;

import java.util.List;

/**
 * 批量加入合集请求体：{ "articleIds": [1, 2, 3] }
 */
public class CollectionArticlesBody {
    private List<Integer> articleIds;

    public List<Integer> getArticleIds() {
        return articleIds;
    }

    public void setArticleIds(List<Integer> articleIds) {
        this.articleIds = articleIds;
    }
}
