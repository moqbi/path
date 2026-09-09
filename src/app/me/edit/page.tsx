import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ScreenHeader } from "@/components/ui";
import { EditProfileForm } from "./form";

export default async function EditProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="screen">
      <ScreenHeader title="تعديل الملف الشخصي" back="/me" />
      <main className="scroll-area px-5 py-4">
        <EditProfileForm
          name={user.name}
          handle={user.handle}
          bio={user.bio}
          city={user.city}
        />
      </main>
    </div>
  );
}
