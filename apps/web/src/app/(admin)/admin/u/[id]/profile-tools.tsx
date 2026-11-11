"use client";

import { moderateProfile } from "@/app/actions";
import { Saver } from "../../saver";

/*
  ملفُّ الحساب بيد المشرف (القاعدة ٤٥٩): الصورةُ والغلافُ يُزالان، والاسمُ والمعرّفُ
  يُكتبان من جديد، والنبذةُ تُمسح. كلُّ نموذجٍ يقول نتيجته (`Saver`)، والإزالةُ بخانة
  تأكيد — ملفُّ صاحبها يذهب ببكسلاته فلا رجعة.
*/

const field = "h-10 min-w-0 grow rounded-xl border border-line bg-paper px-3 text-[12.5px] text-ink outline-none";
const solid = { background: "var(--color-ink)", color: "var(--color-card)" };

function Remove({ userId, act, label, sure }: { userId: string; act: string; label: string; sure: string }) {
  return (
    <Saver action={moderateProfile.bind(null, userId)} className="flex flex-col gap-1.5">
      <input type="hidden" name="do" value={act} />
      <label className="flex items-center gap-2 text-[11.5px] text-muted">
        <input type="checkbox" required className="accent-[var(--color-live)]" />
        {sure}
      </label>
      <button className="self-start rounded-full px-3 py-1.5 text-[11.5px] font-bold" style={{ background: "var(--color-live)", color: "#fff" }}>
        {label}
      </button>
    </Saver>
  );
}

export function ProfileTools({
  userId,
  memberNo,
  name,
  handle,
  bio,
  avatarId,
  coverId,
}: {
  userId: string;
  memberNo: number;
  name: string;
  handle: string | null;
  bio: string | null;
  avatarId: string | null;
  coverId: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold">صورة العرض</p>
          {avatarId ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/public/avatar/${memberNo}?v=${avatarId}`} alt="" className="size-24 rounded-full border border-line object-cover" />
              <Remove userId={userId} act="avatar" label="أزل الصورة" sure="أزلها وأحذف ملفّها" />
            </>
          ) : (
            <p className="text-[12px] text-muted">لا صورة.</p>
          )}
        </div>
        <div className="flex min-w-0 grow flex-col gap-2">
          <p className="text-[12px] font-semibold">الغلاف</p>
          {coverId ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/public/cover/${memberNo}?v=${coverId}`} alt="" className="h-24 w-full max-w-[280px] rounded-xl border border-line object-cover" />
              <Remove userId={userId} act="cover" label="أزل الغلاف" sure="أزله وأحذف ملفّه" />
            </>
          ) : (
            <p className="text-[12px] text-muted">لا غلاف من رفعه — وغلافُ الثيم الملبوس يبقى.</p>
          )}
        </div>
      </div>

      <Saver action={moderateProfile.bind(null, userId)} className="flex flex-col gap-1.5">
        <input type="hidden" name="do" value="name" />
        <span className="text-[12px] font-semibold">الاسم</span>
        <div className="flex gap-2">
          <input name="name" defaultValue={name} maxLength={40} dir="auto" className={field} />
          <button className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold" style={solid}>غيّره</button>
        </div>
      </Saver>

      <Saver action={moderateProfile.bind(null, userId)} className="flex flex-col gap-1.5">
        <input type="hidden" name="do" value="handle" />
        <span className="text-[12px] font-semibold">المعرّف</span>
        <div className="flex gap-2">
          <input name="handle" defaultValue={handle ?? ""} maxLength={21} dir="ltr" placeholder="فارغٌ يزيله" className={field} />
          <button className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold" style={solid}>احفظ المعرّف</button>
        </div>
      </Saver>

      {bio ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold">النبذة</span>
          <p dir="auto" className="rounded-xl px-3 py-2 text-[12px]" style={{ background: "var(--color-chip)" }}>{bio}</p>
          <Remove userId={userId} act="bio" label="امسح النبذة" sure="امسحها" />
        </div>
      ) : null}
    </div>
  );
}
