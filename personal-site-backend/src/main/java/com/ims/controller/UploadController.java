package com.ims.controller;

import com.ims.entity.Result;
import com.ims.util.COSUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
public class UploadController {

    @Autowired
    private COSUtil cosUtil;

    @PostMapping("/api/upload")
    public Result<?> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return Result.error("文件为空");
        }
        File tempFile = null;
        try {
            // 临时文件名用 UUID，避免原始文件名含路径分隔符等风险
            tempFile = Files.createTempFile("upload-", ".tmp").toFile();
            file.transferTo(tempFile);
            String url = cosUtil.upload(tempFile, file.getOriginalFilename());
            return Result.ok(url);
        } catch (Exception e) {
            return Result.error(e.getMessage() != null ? e.getMessage() : "上传失败");
        } finally {
            if (tempFile != null) {
                tempFile.delete();
            }
        }
    }

    /**
     * 兼容 Editor.md 图片上传
     */
    @PostMapping("/upload")
    public Map<String, Object> editorUpload(@RequestParam("editormd-image-file") MultipartFile file) {
        Map<String, Object> response = new HashMap<>();
        if (file.isEmpty()) {
            response.put("success", 0);
            response.put("message", "文件为空");
            return response;
        }
        File tempFile = null;
        try {
            tempFile = Files.createTempFile("upload-", ".tmp").toFile();
            file.transferTo(tempFile);
            String url = cosUtil.upload(tempFile, file.getOriginalFilename());
            response.put("success", 1);
            response.put("url", url);
            response.put("alt", file.getOriginalFilename());
        } catch (Exception e) {
            response.put("success", 0);
            response.put("message", e.getMessage() != null ? e.getMessage() : "上传失败");
        } finally {
            if (tempFile != null) {
                tempFile.delete();
            }
        }
        return response;
    }
}
