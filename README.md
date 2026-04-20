# Node JSON API

基于 Express + JSON 文件的 RESTful API，无需数据库。

## 快速启动

```bash
npm install
npm start          # 生产模式
npm run dev        # 开发模式（热重载，需安装 nodemon）
```

服务默认运行在 `http://localhost:3000`

---

## 登录账号

| 用户名  | 密码    | 角色    | 权限说明               |
|---------|---------|---------|------------------------|
| student | student | student | 只读（查询）           |
| teacher | teacher | teacher | 读 + 新增 + 修改       |
| admin   | admin   | admin   | 全部权限（含删除/用户管理）|

---

## 认证方式

登录后获取 Token，后续请求在 Header 中携带：

```
Authorization: Bearer <token>
```

---

## 接口列表

### 认证

| 方法 | 路径              | 说明             | 权限   |
|------|-------------------|------------------|--------|
| POST | /api/auth/login   | 登录，返回 Token | 无需   |
| GET  | /api/auth/info    | 获取当前用户信息 | 登录后 |

**登录请求示例：**
```json
POST /api/auth/login
{
  "username": "admin",
  "password": "admin"
}
```

**登录响应示例：**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGci...",
    "userInfo": {
      "id": 3,
      "username": "admin",
      "role": "admin",
      "name": "管理员"
    }
  }
}
```

---

### 学生管理 `/api/students`

| 方法   | 路径                  | 说明                         | 权限           |
|--------|-----------------------|------------------------------|----------------|
| GET    | /api/students         | 获取列表（支持筛选/分页）    | 所有登录用户   |
| GET    | /api/students/:id     | 获取单个学生                 | 所有登录用户   |
| POST   | /api/students         | 新增学生                     | teacher, admin |
| PUT    | /api/students/:id     | 修改学生                     | teacher, admin |
| DELETE | /api/students/:id     | 删除学生                     | admin          |

**查询参数（GET 列表）：**
- `keyword` - 按姓名模糊搜索
- `class` - 按班级筛选
- `page` - 页码（从 1 开始）
- `pageSize` - 每页条数

**学生字段：**
```json
{ "id": 1, "name": "张三", "age": 20, "gender": "男", "class": "计算机1班", "score": 88 }
```

---

### 课程管理 `/api/courses`

| 方法   | 路径                  | 说明                         | 权限           |
|--------|-----------------------|------------------------------|----------------|
| GET    | /api/courses          | 获取列表（支持筛选/分页）    | 所有登录用户   |
| GET    | /api/courses/:id      | 获取单个课程                 | 所有登录用户   |
| POST   | /api/courses          | 新增课程                     | teacher, admin |
| PUT    | /api/courses/:id      | 修改课程                     | teacher, admin |
| DELETE | /api/courses/:id      | 删除课程                     | admin          |

**课程字段：**
```json
{ "id": 1, "name": "高等数学", "teacher": "李老师", "credit": 4, "hours": 64 }
```

---

### 用户管理 `/api/users`（仅 admin）

| 方法   | 路径              | 说明         | 权限  |
|--------|-------------------|--------------|-------|
| GET    | /api/users        | 获取用户列表 | admin |
| GET    | /api/users/:id    | 获取单个用户 | admin |
| POST   | /api/users        | 新增用户     | admin |
| PUT    | /api/users/:id    | 修改用户     | admin |
| DELETE | /api/users/:id    | 删除用户     | admin |

---

## 统一响应格式

```json
{
  "code": 200,
  "message": "操作说明",
  "data": {}
}
```

| code | 含义           |
|------|----------------|
| 200  | 成功           |
| 201  | 创建成功       |
| 400  | 参数错误       |
| 401  | 未登录/Token无效 |
| 403  | 权限不足       |
| 404  | 资源不存在     |
| 409  | 数据冲突       |
| 500  | 服务器错误     |
