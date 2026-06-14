# 组件模式约定

数据表格：始终用 DataTable 封装组件，含：
- 服务端分页（cursor-based）
- 搜索 debounce 500ms
- 批量选择 + 批量操作栏（黑色 sticky bar）
- 行高 52px（密集内容 48px）

侧边抽屉：始终用 Sheet 组件，宽度 480px（详情）或 560px（复杂表单）

确认操作：删除/危险操作用 AlertDialog，不用 window.confirm

空状态：始终包含 图标 + 描述文字 + CTA 按钮，三者缺一不可

加载状态：表格用 Skeleton，按钮内用 spinner（宽度不变）
