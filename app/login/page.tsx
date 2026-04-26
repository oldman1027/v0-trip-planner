import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { createClient } from "@/lib/supabase/server"

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/trips")

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
