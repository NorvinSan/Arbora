import { ProfileForms } from "@/components/profile-forms";
import { requireSession } from "@/lib/session";

export default async function ProfilePage() {
  const { user } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Mi perfil</h1>
        <p className="mt-2 text-slate-600">Consulta y actualiza los datos de tu cuenta.</p>
      </div>
      <ProfileForms name={user.name} email={user.email} createdAt={new Date(user.createdAt).toLocaleDateString("es", { dateStyle: "long" })} />
    </div>
  );
}
