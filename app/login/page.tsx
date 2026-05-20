import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { createClient } from "@/lib/supabase/server"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/trips")

  const { next, error, email } = await searchParams

  return (
    <div className="flex min-h-svh flex-col px-4">
      <div className="pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <LoginForm
            next={next}
            initialError={error}
            initialEmail={email}
            isReturningUser={!!email}
          />
        </div>
      </div>
    </div>
  )
}
