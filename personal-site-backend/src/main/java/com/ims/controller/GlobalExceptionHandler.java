package com.ims.controller;

import com.ims.entity.Result;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理：把业务异常统一转为 JSON 响应（code=500 + msg），
 * 替代 Tomcat 默认的 HTML 错误页，前端 request 拦截器才能弹出准确提示。
 * 仅处理携带用户可读信息的 IllegalArgumentException；
 * 其余异常保持抛给容器（不吞掉，便于日志排查）。
 */
@RestControllerAdvice(basePackages = "com.ims.controller")
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<?> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("业务参数校验失败: {}", e.getMessage());
        return Result.error(e.getMessage() == null || e.getMessage().isBlank()
                ? "请求参数不合法" : e.getMessage());
    }
}
