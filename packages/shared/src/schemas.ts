import { z } from "zod";
import { MOMENT_TEXT_MAX, STORY_SECONDS, VOICE_SECONDS } from "./constants";

/**
 * مخطّطات الإدخال.
 *
 * كل ما يدخل الخادم يمرّ من هنا: الجسد والاستعلام والمعاملات. والمخطّط
 * مشتركٌ مع الموبايل، فما يرفضه الخادم يُمنع في الشاشة قبل أن يُرسل.
 */

export const email = z.string().trim().toLowerCase().email("بريد غير صالح");
export const password = z.string().min(8, "كلمة المرور ٨ أحرف فأكثر").max(200);
export const cuid = z.string().min(20).max(40).regex(/^[a-z0-9]+$/i, "معرّف غير صالح");

export const registerInput = z.object({
  email,
  password,
  name: z.string().trim().min(2, "اكتب اسمك").max(40),
});

export const loginInput = z.object({ email, password });

export const refreshInput = z.object({
  refreshToken: z.string().min(20).max(500),
});

export const momentInput = z.object({
  kind: z.enum(["PHOTO", "THOUGHT", "PLACE", "MUSIC"]),
  text: z.string().trim().max(MOMENT_TEXT_MAX).optional(),
  mediaId: cuid.optional(),
  with: z.array(cuid).max(20).optional(),
  audience: z.enum(["CIRCLE", "GROUP", "PICKED"]).default("CIRCLE"),
  audienceGroupId: cuid.optional(),
  viewers: z.array(cuid).max(150).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  place: z.string().trim().max(80).optional(),
});

export const commentInput = z.object({ body: z.string().trim().min(1).max(500) });

export const reactionInput = z.object({
  kind: z.enum(["SMILE", "LAUGH", "GASP", "SAD", "LOVE", "SLEEPY", "CUSTOM"]),
  emoji: z.string().max(8).optional(),
});

export const messageInput = z.object({ body: z.string().trim().min(1).max(2000) });

export const voiceInput = z.object({
  mediaId: cuid,
  seconds: z.coerce.number().int().min(1).max(VOICE_SECONDS.plus),
});

export const storyInput = z.object({
  mediaId: cuid,
  filter: z.string().max(20).optional(),
  seconds: z.coerce.number().int().min(1).max(STORY_SECONDS).optional(),
});

/** طلب رفع ملف: النوع والحجم يُفحصان قبل أن يُعطى رابطٌ مؤقّت. */
export const presignInput = z.object({
  mime: z.string().min(3).max(60),
  bytes: z.coerce.number().int().min(1),
  width: z.coerce.number().int().min(0).max(8000).default(0),
  height: z.coerce.number().int().min(0).max(8000).default(0),
  purpose: z.enum(["AVATAR", "COVER", "MOMENT", "STORY", "MESSAGE", "VOICE"]),
});

export const pageQuery = z.object({
  cursor: cuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type RegisterInput = z.infer<typeof registerInput>;
export type LoginInput = z.infer<typeof loginInput>;
export type MomentInput = z.infer<typeof momentInput>;
export type PresignInput = z.infer<typeof presignInput>;

export const markInput = z.object({ kind: z.enum(["SLEEP", "WAKE"]) });

export const profileInput = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(40),
  handle: z.string().trim().max(21).optional(),
  bio: z.string().trim().max(160).optional(),
  city: z.string().trim().max(40).optional(),
});

export const privacyInput = z.object({
  viewGroupId: cuid.nullish(),
  interactGroupId: cuid.nullish(),
  shareLocation: z.boolean(),
  notifyOnTag: z.boolean(),
});

export const coverInput = z.object({ y: z.coerce.number().min(0).max(100) });

export const groupInput = z.object({ name: z.string().trim().min(1, "اكتب اسم التصنيف").max(20) });

export const friendGroupInput = z.object({ groupId: cuid.nullish() });

export type ProfileInput = z.infer<typeof profileInput>;
export type PrivacyInput = z.infer<typeof privacyInput>;
