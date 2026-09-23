import { useEffect, useRef } from "react";
import { View } from "react-native";

/**
 * عنصرٌ يُعرف مكانُه على الشاشة — لتضع عليه الجولةُ دائرتها.
 *
 * الجولة لا تكتب إحداثيّاتٍ بيدها: الشريطُ السفليّ يرسمه React Navigation
 * بارتفاعٍ يتبع حافّة الجهاز، وزرُّ النشر يُحسب من عرض الشاشة (القاعدة
 * ١٠٨). فكلُّ هدفٍ يُسجّل نفسه هنا، والجولةُ تقيسه **ساعةَ تعرضه**
 * (`measureInWindow`) لا ساعةَ رُسم — فلا تقع الدائرة على مكانٍ تحرّك.
 */
export type Rect = { x: number; y: number; width: number; height: number };

const spots = new Map<string, View>();

export function Spot({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) spots.set(id, node);
    return () => {
      if (spots.get(id) === node) spots.delete(id);
    };
  }, [id]);
  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}

/** مكانُ الهدف الآن — أو `null` إن لم يُرسم (فتُعرض النافذة بلا دائرة). */
export function measureSpot(id: string): Promise<Rect | null> {
  const node = spots.get(id);
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
