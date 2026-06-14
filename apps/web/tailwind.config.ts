import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        "brand-blue": "#185FA5",
        "brand-blue-light": "#E6F1FB",
        "brand-green": "#0F6E56",
        "brand-green-light": "#E1F5EE",
        "brand-purple": "#534AB7",
        "brand-purple-light": "#EEEDFE",
        "brand-amber": "#854F0B",
        "brand-amber-light": "#FAEEDA",
        "brand-gold": "#EF9F27",
        "brand-red": "#A32D2D",
        "brand-red-light": "#FCEBEB",
        // 布局侧栏深色背景（勿与 shadcn 的 sidebar token 混用）
        "sidebar-shell": "#1A1A2E",
        content: "#F5F5F3",
        "content-bg": "#F5F5F3",
        "border-light": "#D3D1C7",
        "text-muted": "#5F5E5A",
        "text-tertiary": "#888780",
      },
    },
  },
};

export default config;
