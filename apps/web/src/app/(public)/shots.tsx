/**
 * أربع شاشاتٍ مصغّرة من التطبيق، مرسومةٌ بعناصر الصفحة نفسها.
 *
 * ولقطاتٌ حقيقية أصدق — لكنها لم تُلتقط بعد، وصورةُ هاتفٍ من مخزون
 * الصور تكذب على من يقرأ. وهذه مبنيّةٌ بألوان التطبيق ومقاساته: ورقٌ
 * أغمق من البطاقات، وشريطٌ علويٌّ داكن، وخطُّ مخطّطٍ على يمين الصور —
 * فما يُرى هنا هو ما يُفتح هناك.
 */

const CHROME = "var(--color-chrome)";
const PAPER = "var(--color-paper)";
const CARD = "var(--color-card)";
const LINE = "var(--color-line)";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ background: PAPER }}>
      <div
        className="flex shrink-0 items-center justify-between px-3 py-2.5"
        style={{ background: CHROME, color: "var(--color-chrome-ink)" }}
      >
        <span className="text-[9px] font-semibold opacity-90">{title}</span>
        <span className="latin text-[9px] font-bold opacity-90">ATHR</span>
      </div>
      <div className="grow overflow-hidden">{children}</div>
      <div
        className="flex shrink-0 items-center justify-around px-2 py-2"
        style={{ background: CARD, borderTop: `1px solid ${LINE}` }}
      >
        {[0, 1, 2, 3, 4].map((slot) => (
          <span
            key={slot}
            className="h-1.5 rounded-full"
            style={{
              width: slot === 0 ? 14 : 9,
              background: slot === 0 ? "var(--color-clay)" : "var(--color-chip)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Dot({ size = 16, gold = false }: { size?: number; gold?: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--color-clay-soft)",
        border: `1.5px solid ${gold ? "var(--color-clay)" : "var(--color-line)"}`,
      }}
    />
  );
}

function Line({ w, dark = false }: { w: number | string; dark?: boolean }) {
  return (
    <span
      className="block rounded-full"
      style={{ width: w, height: 5, background: dark ? "#c3bdad" : "var(--color-chip)" }}
    />
  );
}

/** الخط الزمني: غلافٌ، ثم أسطر أحداثٍ على خط المخطّط، ثم بطاقة صورة. */
export function MomentsShot() {
  return (
    <Frame title="اللحظات">
      <div className="flex h-full flex-col">
        <div
          className="h-14 shrink-0"
          style={{ background: "linear-gradient(160deg, #3a4b58, #7b6350)" }}
        />
        <div className="relative grow px-3 pt-3">
          {/* خط المخطّط على محور عمود الصور. */}
          <span
            className="absolute top-0 bottom-0"
            style={{ right: 17, width: 1.5, background: "var(--color-line)" }}
          />
          <div className="flex flex-col gap-3">
            {["مكان", "أغنية", "خاطرة"].map((row) => (
              <div key={row} className="flex items-start gap-2">
                <Dot />
                <span className="flex flex-col gap-1 pt-0.5">
                  <Line w={62} dark />
                  <Line w={38} />
                </span>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <Dot gold />
              <span
                className="grow overflow-hidden rounded-lg"
                style={{ background: CARD, border: `1px solid ${LINE}` }}
              >
                <span
                  className="block h-10"
                  style={{ background: "linear-gradient(135deg, #f6b93b, #ff7a5a)" }}
                />
                <span className="flex flex-col gap-1 p-1.5">
                  <Line w="72%" dark />
                  <Line w="48%" />
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** الدائرة: صفوفُ أصدقاء، ورقمُ العضوية بجانب الاسم. */
export function CircleShot() {
  return (
    <Frame title="الأصدقاء">
      <div className="flex flex-col gap-2 p-3">
        <span
          className="mb-1 block rounded-full px-2 py-1 text-center text-[8.5px] font-bold"
          style={{ background: "var(--color-gold-soft)", color: "var(--color-clay-ink)" }}
        >
          ٣٤ من ١٥٠
        </span>
        {[0, 1, 2, 3, 4].map((row) => (
          <span
            key={row}
            className="flex items-center gap-2 rounded-lg p-1.5"
            style={{ background: CARD, border: `1px solid ${LINE}` }}
          >
            <Dot size={20} gold={row === 1} />
            <span className="flex grow flex-col gap-1">
              <Line w={row % 2 ? 46 : 58} dark />
              <Line w={28} />
            </span>
          </span>
        ))}
      </div>
    </Frame>
  );
}

/** القصص: حلقةٌ ملوّنة تعني «فيها ما لم تره»، ثم معاينةٌ كبيرة. */
export function StoriesShot() {
  return (
    <Frame title="القصص">
      <div className="flex h-full flex-col">
        <div className="flex gap-2 p-3 pb-2">
          {[true, true, false, false].map((unseen, index) => (
            <span
              key={index}
              className="h-8 w-8 shrink-0 rounded-full"
              style={{
                background: "var(--color-clay-soft)",
                border: unseen ? "2px solid #ff7a5a" : `2px solid ${LINE}`,
              }}
            />
          ))}
        </div>
        <div className="grow px-3 pb-3">
          <span
            className="flex h-full w-full flex-col justify-end rounded-xl p-2"
            style={{ background: "linear-gradient(170deg, #f6b93b 5%, #ff7a5a 60%, #7b3f3a 100%)" }}
          >
            <span className="flex flex-col gap-1">
              <Line w="66%" dark />
              <Line w="40%" />
            </span>
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** المحادثات: فقاعتان وإيصالٌ بصحّين. */
export function ChatShot() {
  return (
    <Frame title="المحادثة">
      <div className="flex flex-col gap-2.5 p-3">
        <span
          className="max-w-[78%] self-start rounded-xl rounded-tr-sm p-2"
          style={{ background: CARD, border: `1px solid ${LINE}` }}
        >
          <Line w={70} dark />
        </span>
        <span
          className="flex max-w-[78%] flex-col gap-1.5 self-end rounded-xl rounded-tl-sm p-2"
          style={{ background: "var(--color-clay-soft)", border: "1px solid var(--color-gold-line)" }}
        >
          <Line w={54} dark />
          <span className="flex items-center gap-1 self-start">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="var(--color-clay-ink)" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M2 13 L7 18 L14 8" />
              <path d="M10 13 L13 16 L21 6" />
            </svg>
          </span>
        </span>
        <span
          className="max-w-[78%] self-start rounded-xl rounded-tr-sm p-2"
          style={{ background: CARD, border: `1px solid ${LINE}` }}
        >
          <Line w={44} dark />
        </span>
        <span
          className="mt-1 flex items-center gap-2 rounded-full px-2.5 py-2"
          style={{ background: CARD, border: `1px solid ${LINE}` }}
        >
          <Line w={52} />
        </span>
      </div>
    </Frame>
  );
}
