import type { HTMLAttributes } from "react";
import { Column, Link, Row, Section } from "@react-email/components";

type EmailCtaButtonProps = {
  href: string;
  label: string;
};

/**
 * 邮件客户端友好主按钮。
 * 用 table 单元格底色承载按钮，避免 padding 写在 <a> 上导致空心框/重影。
 */
export function EmailCtaButton({ href, label }: EmailCtaButtonProps) {
  return (
    <Section style={wrap}>
      <Row>
        <Column align="center">
          <table
            role="presentation"
            cellSpacing={0}
            cellPadding={0}
            border={0}
            style={{ margin: "0 auto" }}
          >
            <tbody>
              <tr>
                <td
                  align="center"
                  style={td}
                  // Outlook 等邮件客户端仍依赖 bgcolor；TS DOM 类型未收录该属性
                  {...({ bgcolor: "#0F6E56" } as HTMLAttributes<HTMLTableCellElement>)}
                >
                  <Link href={href} style={anchor}>
                    {label}
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </Column>
      </Row>
    </Section>
  );
}

const wrap = {
  textAlign: "center" as const,
  margin: "28px 0 18px",
};

const td = {
  backgroundColor: "#0F6E56",
  borderRadius: "10px",
  textAlign: "center" as const,
};

const anchor = {
  backgroundColor: "#0F6E56",
  border: "1px solid #0F6E56",
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  fontSize: "16px",
  fontWeight: "700" as const,
  lineHeight: "48px",
  padding: "0 32px",
  textAlign: "center" as const,
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
};
