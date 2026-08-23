package com.ims.entity;

/**
 * 管理员实体
 */
public class Admin {
    private Integer id;
    private String username;
    private String pwd;
    private String salt;
    private Boolean forceChange;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPwd() {
        return pwd;
    }

    public void setPwd(String pwd) {
        this.pwd = pwd;
    }

    public String getSalt() {
        return salt;
    }

    public void setSalt(String salt) {
        this.salt = salt;
    }

    public Boolean getForceChange() {
        return forceChange;
    }

    public void setForceChange(Boolean forceChange) {
        this.forceChange = forceChange;
    }
}
