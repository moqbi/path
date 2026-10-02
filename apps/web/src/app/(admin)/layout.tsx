import type { Metadata } from "next";
import { NavProbe } from "@/components/nav";

/* اللوحة وحدها تحمل اسمها؛ الجذر يحمل اسم المنتج للصفحات العامة. */
export const metadata: Metadata = { title: "آثار مومنتس · لوحة التحكم" };

/**
 * اللوحة داخل هيكل الهاتف (`.shell`) على الجوّال كما هي في التطبيق،
 * وعلى الشاشة العريضة تنفرد بعرضها (`.admin-shell` في `globals.css`):
 * الأقسام عمودٌ جانبيّ والمحتوى يملأ ما بقي — لوحةٌ في ٤٣٠ بكسلاً وسط
 * شاشة كمبيوتر تُقرأ هاتفاً معروضاً لا أداةَ عمل. والصفحات العامة تحته بعرضٍ كامل:
 * صفحةُ هبوطٍ محشورةٌ في ٤٣٠ بكسلاً تبدو تطبيقاً معطوباً لا موقعاً.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell admin-shell">
      <NavProbe />
      {children}
    </div>
  );
}
