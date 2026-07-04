import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          secondary: "var(--surface-secondary)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
          muted: "var(--text-secondary)",
        },
        "border-strong": "var(--border-strong)",
        "brand-green": {
          DEFAULT: "var(--brand-green)",
          soft: "var(--brand-green-soft)",
        },
        "brand-green-light": "var(--brand-green-soft)",
        "ai-purple": {
          DEFAULT: "var(--ai-purple)",
          soft: "var(--ai-purple-soft)",
        },
        danger: "var(--danger)",
        /* 向后兼容别名 */
        "brand-blue": "var(--info)",
        "brand-blue-light": "#E6F1FB",
        "brand-purple": "var(--ai-purple)",
        "brand-purple-light": "var(--ai-purple-soft)",
        "brand-amber": "#854F0B",
        "brand-amber-light": "#FAEEDA",
        "brand-gold": "#EF9F27",
        "brand-red": "var(--danger)",
        "brand-red-light": "#FCEBEB",
        "sidebar-shell": "#1A1A2E",
        content: "var(--surface-secondary)",
        "content-bg": "var(--background)",
        "border-light": "var(--border-strong)",
        "text-muted": "var(--text-secondary)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontSize: {
        xs: ["var(--font-size-xs)", { lineHeight: "var(--font-size-xs--line-height)" }],
        sm: ["var(--font-size-sm)", { lineHeight: "var(--font-size-sm--line-height)" }],
        base: [
          "var(--font-size-base)",
          { lineHeight: "var(--font-size-base--line-height)" },
        ],
        lg: ["var(--font-size-lg)", { lineHeight: "var(--font-size-lg--line-height)" }],
        xl: [
          "var(--font-size-xl)",
          {
            lineHeight: "var(--font-size-xl--line-height)",
            fontWeight: "var(--font-weight-xl)",
          },
        ],
        "2xl": [
          "var(--font-size-2xl)",
          {
            lineHeight: "var(--font-size-2xl--line-height)",
            fontWeight: "var(--font-weight-2xl)",
          },
        ],
        "3xl": [
          "var(--font-size-3xl)",
          {
            lineHeight: "var(--font-size-3xl--line-height)",
            fontWeight: "var(--font-weight-3xl)",
          },
        ],
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        12: "var(--space-12)",
        16: "var(--space-16)",
      },
      animation: {
        wiggle: "wiggle 0.5s ease-in-out",
        float: "float 3s ease-in-out infinite",
        slideIn: "slideIn 0.4s ease-out",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "33%": { transform: "rotate(-3deg)" },
          "66%": { transform: "rotate(3deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        slideIn: {
          "0%": { transform: "translateX(40px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
};

export default config;
