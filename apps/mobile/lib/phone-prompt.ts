import { create } from "zustand";

/**
 * شاشةُ الرقم بعد الدخول مفتوحة — الجولةُ تنتظرها (القاعدة ٢٩٧): طبقةٌ فوق المكدّس
 * كلّه كانت ستُرسم فوق حقل الرقم.
 */
export const usePhonePrompt = create<{ open: boolean }>(() => ({ open: false }));
