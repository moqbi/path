import type { Metadata } from "next";
import { ContactForm } from "./form";

export const metadata: Metadata = { title: "تواصل معنا · ATHAR Moments" };

export default function ContactPage() {
  return (
    <div className="prose">
      <h1 className="text-[24px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
        تواصل معنا
      </h1>

      <p>
        إن كان عندك حساب، فأسرعُ طريقٍ هو «الدعم» داخل التطبيق: رسالتُك
        تصلنا وتقرأ ردّنا في مكان سؤالك. ومن هنا يكتب من لا حساب له — أو من
        حُذف حسابه فلم يبقَ له باب.
      </p>

      <ContactForm />

      <p className="text-[12px] text-faint">
        نقرأ كل ما يصل. وما يخصّ بلاغاً عن محتوى يُعالَج أولاً.
      </p>
    </div>
  );
}
