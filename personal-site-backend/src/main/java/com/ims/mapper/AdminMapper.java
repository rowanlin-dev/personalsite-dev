package com.ims.mapper;

import com.ims.entity.Admin;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface AdminMapper {

    @Select("SELECT * FROM admin WHERE username = #{username}")
    Admin findByUsername(@Param("username") String username);

    @Select("SELECT COUNT(*) FROM admin")
    long count();

    @Insert("INSERT INTO admin (username, pwd, salt) VALUES (#{username}, #{pwd}, #{salt})")
    int insert(Admin admin);

    @Update("UPDATE admin SET username = #{username}, pwd = #{pwd}, salt = '', force_change = 0 WHERE id = #{id}")
    int updateCredentials(Admin admin);
}
