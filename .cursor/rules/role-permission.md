# 角色权限规则（每个 API 都要检查）

四种角色：
PLATFORM_ADMIN → 可访问所有数据
ORGANIZER(event_id) → 只能访问自己创建的活动数据
EXPO_ORGANIZER(event_id) → 只能访问自己展会的数据
EXHIBITOR(booth_id) → 只能访问自己展位的数据

关键约束：
- ORGANIZER 不能看到其他主办方的活动
- EXHIBITOR 不能看到同展会其他展商的线索
- 所有涉及 event_id 的查询必须验证 ownership

Session 结构：
session.user.id → user_id
session.user.role → 当前激活角色
session.user.entityId → 关联的 event_id 或 booth_id
