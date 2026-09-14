import type { Env, MiddlewareHandler, ValidationTargets } from "hono";
import { validator } from "hono/validator";
import type { ZodType, input, output } from "zod";

/**
 * تحقّقٌ واحد لكل مدخل.
 *
 * الجسد والاستعلام والمعاملات كلّها تمرّ من هنا: ما لم يوصف بمخطّط لا
 * يدخل. والرسالة تُردّ بالعربية مع اسم الحقل، لا «Invalid input» عارية.
 *
 * التواقيع العامّة تنقل نوع المخطّط إلى `c.req.valid(target)`، فالمسار
 * يقرأ مدخلاته مكتوبةً لا مظنونة.
 */
export function zValidator<
  T extends ZodType,
  Target extends keyof ValidationTargets,
  E extends Env = Env,
  P extends string = string,
  V extends {
    in: { [K in Target]: input<T> };
    out: { [K in Target]: output<T> };
  } = {
    in: { [K in Target]: input<T> };
    out: { [K in Target]: output<T> };
  },
>(target: Target, schema: T): MiddlewareHandler<E, P, V> {
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
    return parsed.data as output<T>;
  }) as MiddlewareHandler<E, P, V>;
}
