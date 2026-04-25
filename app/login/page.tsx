import { redirect } from "next/navigation"

export default async function LoginPage() {
  // AUTH DISABLED FOR DEV: Redirect login page to home (auto-signin handles auth)
  // To re-enable: restore the login form component and remove this redirect
  redirect("/")
}
