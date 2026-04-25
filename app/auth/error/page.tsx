import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {params?.error ? `Error: ${params.error}` : "We couldn't sign you in. The link may have expired."}
            </p>
            <Button asChild className="rounded-xl">
              <Link href="/login">Try again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
