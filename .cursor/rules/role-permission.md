# ConnectIQ 角色权限规则（重构后）

## 三层角色体系

### 层级 1：平台管理员（PLATFORM_ADMIN）
- user_type = 'PLATFORM_ADMIN'
- 职责：平台运营、账号审核、活动审核、内容审核
- 登录路由：/platform/
- 不直接操作具体活动内容

### 层级 2：账号管理员（ACCOUNT_ADMIN）
- user_type = 'ACCOUNT_ADMIN'
- 需要：admin_status = 'APPROVED' 才能使用管理功能
- 关联：org_id 指向其 Organization 记录
- 登录路由：/organizer/ 或 /expo/ 或 /exhibitor/
- 只能访问 org_id 匹配的活动/展位数据

### 层级 3：最终用户（END_USER）
- user_type = 'END_USER'（默认）
- 只使用移动端（小程序/App）
- 不能访问任何 PC 管理端 API

## API 权限检查规范

每个 API Route 必须：
1. 调用对应的 requireXxx 函数
2. 检查返回值是否包含 error（有则直接 return error）
3. 使用返回的 session / orgId / event 等数据进行业务逻辑

示例：
```typescript
export async function GET(req: NextRequest, { params }) {
  const result = await requireEventAccessCheck(req, params.eventId)
  if ('error' in result) return result.error
  const { session, event, orgId } = result
  // ... 业务逻辑
}
```

## 数据查询安全规则
- ACCOUNT_ADMIN 查询活动：必须加 where: { orgId: session.user.orgId }
- ACCOUNT_ADMIN 查询展位：必须通过 event.orgId 验证归属
- ACCOUNT_ADMIN 查询用户池：必须加 where: { orgId: session.user.orgId }
- 禁止只用 user_id 作为过滤条件（容易被伪造）

## Session 字段

```typescript
session.user.userType    // END_USER | ACCOUNT_ADMIN | PLATFORM_ADMIN
session.user.orgId       // 账号管理员关联组织 ID
session.user.orgSlug     // 组织主页 slug
session.user.accountType // CONFERENCE_ORGANIZER | EXPO_ORGANIZER | EXHIBITOR
session.user.adminStatus // PENDING_REVIEW | APPROVED | REJECTED | SUSPENDED
```

## 迁移说明

- 旧 `UserRole` / `UserRoleAssignment` 仍保留，登录时作为 fallback 映射到 `userType`
- 旧路由暂用 throw 版 `requireAuth` / `requireEventAccess`；新路由请用 `requireEventAccessCheck` 等返回 `{ error }` 的函数
