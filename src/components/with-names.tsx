"use client";

import { useRouter } from "next/navigation";

/**
 * «مع فلان وفلان» — كلُّ اسمٍ يفتح ملفّه، واسمُك يفتح «أنا» (القاعدة ٢٢٩).
 *
 * أزرارٌ لا روابط: السطرُ قد يجلس داخل رابط اللحظة، ورابطٌ في رابط لا يصحّ
 * (القاعدة ٢٨). والضغطةُ توقف الصعود فلا تفتح اللحظةَ تحت الاسم.
 */
export function WithNames({
  people,
  viewerId,
}: {
  people: { id: string; name: string }[];
  viewerId?: string;
}) {
  const router = useRouter();
  return (
    <span>
      {"مع "}
      {people.map((person, index) => (
        <span key={person.id}>
          {index > 0 ? " و" : ""}
          <button
            type="button"
            dir="auto"
            className="font-bold text-clay-ink hover:underline"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              router.push(person.id === viewerId ? "/me" : `/u/${person.id}`);
            }}
          >
            {person.name}
          </button>
        </span>
      ))}
    </span>
  );
}
