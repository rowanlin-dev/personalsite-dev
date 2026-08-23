package com.ims.util;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.model.COSObjectSummary;
import com.qcloud.cos.model.CopyObjectRequest;
import com.qcloud.cos.model.ListObjectsRequest;
import com.qcloud.cos.model.ObjectListing;
import com.qcloud.cos.model.ObjectMetadata;
import com.qcloud.cos.model.PutObjectRequest;
import com.qcloud.cos.region.Region;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 腾讯云 COS 上传工具
 */
@Component
public class COSUtil {

    @Value("${cos.secretId}")
    private String secretId;

    @Value("${cos.secretKey}")
    private String secretKey;

    @Value("${cos.bucket}")
    private String bucket;

    @Value("${cos.region}")
    private String region;

    @Value("${cos.domain}")
    private String domain;

    @Value("${cos.publicPrefix:public/}")
    private String publicPrefix;

    @Value("${cos.privatePrefix:private/}")
    private String privatePrefix;

    private COSClient cosClient;

    /**
     * 允许上传的文件类型：扩展名 -> 文件头 Magic Number 前缀（hex，大写）。
     * 仅此白名单内的类型可通过校验，杜绝 .html/.svg/.jsp 等可执行/投毒载体。
     * webp 因头部结构特殊（RIFF + 偏移 8 处 WEBP），单独在 detectExtension 中判断。
     */
    private static final Map<String, String> EXT_MAGIC = new HashMap<>();
    static {
        EXT_MAGIC.put("jpg", "FFD8FF");   // JPEG
        EXT_MAGIC.put("png", "89504E47"); // PNG
        EXT_MAGIC.put("gif", "474946");   // GIF (GIF87a / GIF89a)
        EXT_MAGIC.put("pdf", "25504446"); // PDF (%PDF)
    }

    @PostConstruct
    public void init() {
        COSCredentials credentials = new BasicCOSCredentials(secretId, secretKey);
        ClientConfig clientConfig = new ClientConfig(new Region(region));
        cosClient = new COSClient(credentials, clientConfig);
    }

    /**
     * 上传文件到 COS，返回可访问 URL。
     * 扩展名由文件真实内容（Magic Number）推导，不信任客户端传入的原始文件名，
     * 既防止“改名绕过扩展名白名单”，也避免路径/后缀注入。
     */
    public String upload(File file, String originalName) {
        String ext = detectExtension(file);
        if (ext == null) {
            throw new IllegalArgumentException("不支持的文件类型，仅允许 jpg / png / gif / webp / pdf");
        }
        String key = publicPrefix + UUID.randomUUID() + "." + ext;
        PutObjectRequest request = new PutObjectRequest(bucket, key, file);
        cosClient.putObject(request);
        return "https://" + domain + "/" + key;
    }

    /**
     * 通过文件头 Magic Number 判断真实类型，返回白名单内的扩展名；
     * 无法识别或不在白名单时返回 null（调用方据此拒绝上传）。
     */
    private String detectExtension(File file) {
        byte[] head = new byte[12];
        int n;
        try (InputStream in = new FileInputStream(file)) {
            n = in.read(head);
        } catch (IOException e) {
            return null;
        }
        if (n < 4) {
            return null;
        }
        String hex = toHex(head, n).toUpperCase();
        // WEBP：偏移 0 为 RIFF(52494646)，偏移 8 处为 WEBP(57454250)
        if (hex.startsWith("52494646") && n >= 12 && hex.substring(16).startsWith("57454250")) {
            return "webp";
        }
        for (Map.Entry<String, String> entry : EXT_MAGIC.entrySet()) {
            if (hex.startsWith(entry.getValue())) {
                return entry.getKey();
            }
        }
        return null;
    }

    private static String toHex(byte[] bytes, int len) {
        StringBuilder sb = new StringBuilder(len * 2);
        for (int i = 0; i < len; i++) {
            sb.append(String.format("%02x", bytes[i] & 0xff));
        }
        return sb.toString();
    }

    /**
     * 列出指定前缀下的所有对象（分页拉取全部），返回去 SDK 耦合的元信息。
     */
    public List<CosObjectInfo> listByPrefix(String prefix) {
        ListObjectsRequest req = new ListObjectsRequest()
                .withBucketName(bucket)
                .withPrefix(prefix)
                .withMaxKeys(1000);
        List<CosObjectInfo> infos = new ArrayList<>();
        ObjectListing listing;
        do {
            listing = cosClient.listObjects(req);
            for (COSObjectSummary summary : listing.getObjectSummaries()) {
                infos.add(new CosObjectInfo(summary.getKey(), summary.getSize(), summary.getLastModified().getTime()));
            }
            req.setMarker(listing.getNextMarker());
        } while (listing.isTruncated());
        return infos;
    }

    /**
     * 删除单个对象。
     */
    public void deleteObject(String key) {
        cosClient.deleteObject(bucket, key);
    }

    /**
     * 同桶内复制对象（源 key -> 目标 key），常用于素材库「迁移目录前缀」。
     * COS 同区复制是服务端拷贝，不产生下载/上传流量。
     */
    public String copyObject(String srcKey, String destKey) {
        CopyObjectRequest req = new CopyObjectRequest(bucket, srcKey, bucket, destKey);
        cosClient.copyObject(req);
        return "https://" + domain + "/" + destKey;
    }

    /**
     * 判断对象是否存在（import-url 收录前校验同桶 URL 的真实性）。
     */
    public boolean doesObjectExist(String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        return cosClient.doesObjectExist(bucket, key);
    }

    /**
     * 内容 hash 命名上传：对文件字节算 SHA-256，取前 12 位 hex + 内容推导扩展名；
     * key = 去掉末尾斜杠的 prefix + "/" + hash + ext（避免双斜杠）。返回公开访问 URL。
     * 扩展名由文件真实内容（Magic Number）推导，与 upload 一致，杜绝类型伪装。
     */
    public String uploadTo(String prefix, MultipartFile file) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("读取上传文件失败", e);
        }
        String ext = detectExtension(bytes);
        if (ext == null) {
            throw new IllegalArgumentException("不支持的文件类型，仅允许 jpg / png / gif / webp / pdf");
        }
        String hash = sha256Hex(bytes, 12);
        String cleanPrefix = prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix;
        String key = cleanPrefix + "/" + hash + "." + ext;
        ObjectMetadata meta = new ObjectMetadata();
        meta.setContentLength(bytes.length);
        cosClient.putObject(new PutObjectRequest(bucket, key, new ByteArrayInputStream(bytes), meta));
        return "https://" + domain + "/" + key;
    }

    /**
     * 为私有对象生成签名 URL（读 secretId/secretKey 对应的同一 COSClient）。
     */
    public String generatePresignedUrl(String key, long expireSeconds) {
        Date expiration = new Date(System.currentTimeMillis() + expireSeconds * 1000);
        return cosClient.generatePresignedUrl(bucket, key, expiration).toString();
    }

    /**
     * 由对象 key 拼接公开访问 URL。
     */
    public String publicUrl(String key) {
        return "https://" + domain + "/" + key;
    }

    /**
     * 从公开 URL 反解对象 key。
     */
    public String keyFromUrl(String url) {
        String base = "https://" + domain + "/";
        if (url != null && url.startsWith(base)) {
            return url.substring(base.length());
        }
        return url;
    }

    /**
     * 通过字节内容（Magic Number）判断真实类型，返回白名单内扩展名；无法识别返回 null。
     */
    private String detectExtension(byte[] data) {
        if (data == null || data.length < 4) {
            return null;
        }
        String hex = toHex(data, Math.min(data.length, 12)).toUpperCase();
        // WEBP：偏移 0 为 RIFF(52494646)，偏移 8 处为 WEBP(57454250)
        if (hex.startsWith("52494646") && data.length >= 12 && hex.substring(16).startsWith("57454250")) {
            return "webp";
        }
        for (Map.Entry<String, String> entry : EXT_MAGIC.entrySet()) {
            if (hex.startsWith(entry.getValue())) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * 计算字节数组 SHA-256，返回前 hexLen 位 hex（hexLen 为偶数）。
     */
    private String sha256Hex(byte[] data, int hexLen) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            int bytes = hexLen / 2;
            StringBuilder sb = new StringBuilder(hexLen);
            for (int i = 0; i < bytes; i++) {
                sb.append(String.format("%02x", digest[i] & 0xff));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
