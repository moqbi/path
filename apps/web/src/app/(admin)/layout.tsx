import type { Metadata } from "next";
import { NavProbe } from "@/components/nav";

/* اللوحة وحدها تحمل اسمها؛ الجذر يحمل اسم المنتج للصفحات العامة. */
export const metadata: Metadata = { title: "آثار · لوحة التحكم" };

/**
 * اللوحة داخل هيكل الهاتف (`.shell`) كما هي في التطبيق — نُقلت كما هي،
 * ومقاساتها مقاسات شاشةٍ لا صفحةِ ويب. والصفحات العامة تحته بعرضٍ كامل:
 * صفحةُ هبوطٍ محشورةٌ في ٤٣٠ بكسلاً تبدو تطبيقاً معطوباً لا موقعاً.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <NavProbe />
      {children}
    </div>
  );
}
