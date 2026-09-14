import type { MiddlewareHandler, ValidationTargets } from "hono";
import { validator } from "hono/validator";
import type { ZodType } from "zod";

/**
 * تحقّقٌ واحد لكل مدخل.
 *
 * الجسد والاستعلام والمعاملات كلّها تمرّ من هنا: ما لم يوصف بمخطّط لا
 * يدخل. والرسالة تُردّ بالعربية مع اسم الحقل، لا «Invalid input» عارية.
 */
export function zValidator<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
): MiddlewareHandler {
  return validator(target, (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.join(".");
      return c.json(
        { error: field ? `${field}: ${issue.message}` : (issue?.message ?? "طلب غير صالح") },
        400,
      );
    }
    return parsed.data;
  }) as MiddlewareHandler;
}
