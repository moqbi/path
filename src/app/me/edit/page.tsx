import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ScreenHeader } from "@/components/ui";
import { ProfileCover } from "../cover";
import { EditProfileForm } from "./form";

export default async function EditProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="screen">
      <ScreenHeader title="تعديل الملف الشخصي" back="/me" />
      <main className="scroll-area py-4">
        {/* الغلاف يُغيَّر ويُضبط ويُزال هنا — لا فوق الملف نفسه. */}
        <section className="mb-5">
          <div className="mb-2 px-5">
            <p className="text-[13px] font-semibold">الغلاف</p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              غيّر الصورة، أو اسحبها بعد «اضبط» حتى يظهر ما تريد.
            </p>
          </div>
          <ProfileCover
            mediaId={user.coverMediaId}
            spec={user.background?.spec ?? null}
            initialY={user.coverY}
            height={146}
            manage
            chrome={false}
          />
        </section>

        <div className="px-5">
        <EditProfileForm
          name={user.name}
          handle={user.handle}
          bio={user.bio}
          city={user.city}
        />
        </div>
      </main>
    </div>
  );
}
