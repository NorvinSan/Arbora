import { ProfileForms } from "@/components/profile-forms";
import { UserRound } from "lucide-react";
import { requireSession } from "@/lib/session";

export default async function ProfilePage() {
  const { user } = await requireSession();

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-5 border-b border-[#dce7d9] pb-8"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#e6f0e2] text-[#356747]"><UserRound className="size-7" /></span><div><p className="eyebrow mb-2">Tu cuenta</p><h1 className="page-title">Mi perfil</h1><p className="mt-3 text-sm text-[#607266]">Mantén tu información y la seguridad de tu cuenta al día.</p></div></header>
      <ProfileForms name={user.name} email={user.email} createdAt={new Date(user.createdAt).toLocaleDateString("es", { dateStyle: "long" })} />
    </div>
  );
}
