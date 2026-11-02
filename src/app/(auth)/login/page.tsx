import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentSession } from "@/lib/session";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
