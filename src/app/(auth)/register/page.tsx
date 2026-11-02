import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentSession } from "@/lib/session";

export default async function RegisterPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return <AuthForm mode="register" />;
}
