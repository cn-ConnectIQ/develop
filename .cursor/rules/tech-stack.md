# 技术栈约束（Cursor 始终遵守）

框架：Next.js 14 App Router，不用 Pages Router
语言：TypeScript strict，禁止 any
UI：shadcn/ui + Tailwind CSS，禁止另引 UI 库
ORM：Prisma，禁止直接写 SQL
表单：react-hook-form + zod
数据请求：React Query (TanStack)
图表：Recharts
拖拽：dnd-kit

API Route 统一响应格式：
成功 → { data: T, meta?: { total, page } }
失败 → { error: string, code: ErrorCode }

每个 API Route 必须：
1. 检查 getServerSession，未登录返回 401
2. 检查用户角色权限，不符合返回 403
3. 用 Zod schema 验证请求体
4. 用 try/catch 包裹，统一错误格式
