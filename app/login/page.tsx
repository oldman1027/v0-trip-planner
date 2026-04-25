import Link from "next/link"
import { redirect } from "next/navigation"
import { MapPin } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { createClient } from "@/lib/supabase/server"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/trips")

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-6 md:p-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <span className="font-serif text-xl tracking-tight">Trip Planner</span>
      </Link>

      <div className="w-full max-w-sm">
        <LoginForm />
      </div>

      <p className="mt-8 max-w-sm text-pretty text-center text-sm text-muted-foreground">
        We&apos;ll email you a magic link. No passwords, no nonsense.
      </p>
    </div>
  )
}
