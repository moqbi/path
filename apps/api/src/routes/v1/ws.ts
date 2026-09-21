import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import { readAccess } from "../../lib/tokens";
import { isOnline, join, leave, push } from "../../lib/hub";
import { prisma } from "@athar/db";
import { passed } from "../../lib/throttle";
import * as dm from "../../services/dm";

/**
 * الخطّ الحيّ.
 *
 * المصادقة في المصافحة نفسها: التوكن يأتي معامَلَ استعلام لأنّ متصفّحات
 * WebSocket لا تسمح بترويسةٍ في `new WebSocket(...)`. وهذا يعني أنّ
 * التوكن قد يظهر في سجلّات الوسطاء — ولذلك هو توكن *الوصول* القصير
 * (خمس عشرة دقيقة) لا توكن التجديد، ولا يُقبل هنا غيره.
 *
 * وما يُرسله العميل عبر الخطّ لا يكتب في القاعدة: الكتابة عبر HTTP
 * وحده حيث يمرّ كل مدخلٍ على Zod. الخطّ للاستماع ولنبض الحضور فقط —
 * قناتان لكتابةٍ واحدة تعني تحقّقين يفترقان يوماً.
 */

/** نبضٌ كل نصف دقيقة: وسطاءٌ كثيرون يقطعون الخطّ الصامت بعد دقيقة. */
const BEAT_MS = 30_000;

type Live = { userId: string; beat: ReturnType<typeof setInterval> };

export function mountWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/v1/live",
    upgradeWebSocket(async (c) => {
      const token = c.req.query("token") ?? "";
      const claims = await readAccess(token).catch(() => null);

      // لا مصافحة بلا توكن صالح: الوصلة تُقبل ثم تُغلق فوراً بسبب،
      // فالعميل يعرف أنّ عليه التجديد بدل أن يعيد المحاولة أبداً.
      let state: Live | null = null;

      return {
        onOpen(_event: Event, socket: WSContext) {
          if (!claims) {
            socket.close(4401, "unauthorized");
            return;
          }

          join(claims.sub, socket);
          void onPresence(claims.sub);

          const beat = setInterval(() => {
            try {
              socket.send(JSON.stringify({ event: "beat", data: Date.now() }));
            } catch {
              /* تُنظَّف في الإغلاق */
            }
          }, BEAT_MS);

          state = { userId: claims.sub, beat };
          socket.send(JSON.stringify({ event: "ready", data: { userId: claims.sub } }));
        },

        onMessage(event: MessageEvent, socket: WSContext) {
          if (!state) return;
          // «أنا هنا» وحدها تُقبل: كل ما عداها يمرّ من HTTP.
          if (String(event.data) === "ping") {
            socket.send(JSON.stringify({ event: "beat", data: Date.now() }));
          }
        },

        onClose(_event: Event, socket: WSContext) {
          if (!state) return;
          clearInterval(state.beat);
          // الوصلة نفسها تُنزع لا وصلةٌ أخرى لصاحبها: للشخص الواحد
          // جوّالٌ وحاسوب، وإغلاق أحدهما لا يُسكت الآخر.
          leave(state.userId, socket);
          state = null;
        },

        onError(_event: Event, socket: WSContext) {
          if (!state) return;
          clearInterval(state.beat);
          leave(state.userId, socket);
          state = null;
        },
      };
    }),
  );
}

/**
 * ما يجري حين يظهر أحدهم.
 *
 * حضوره يُختم، وما لم يُسلَّم من رسائله يُسلَّم، ويُخبَر مرسلوها — فعلامة
 * «وصلت» تظهر عندهم في اللحظة لا عند فتحهم للشاشة.
 */
async function onPresence(userId: string) {
  try {
    /*
       والختمُ مرّةً كلّ دقيقة لا مع كل اتّصال: شبكةٌ متقطّعة تفتح
       الويب-سوكِت وتغلقه مراراً في الدقيقة، فيصير الحضورُ — وهو زينة —
       أكثرَ ما يُكتب في أكثر الجداول قراءة.
    */
    if (passed(`seen:${userId}`, 60_000)) {
      await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    }

    const pending = await prisma.message.findMany({
      where: {
        senderId: { not: userId },
        deliveredAt: null,
        conversation: { OR: [{ aId: userId }, { bId: userId }] },
      },
      select: { senderId: true, conversationId: true },
      take: 500,
    });
    if (pending.length === 0) return;

    await dm.markDelivered(userId);
    for (const senderId of new Set(pending.map((row) => row.senderId))) {
      push(senderId, "delivered", { to: userId });
    }
  } catch (error) {
    console.error("✗ الحضور", error);
  }
}

export { isOnline };
