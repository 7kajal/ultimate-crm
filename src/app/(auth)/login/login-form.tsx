"use client"

import { ArrowRightIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setError(null)

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message ?? "Invalid credentials")
        return
      }

      const target = next && next.startsWith("/") ? next : "/"
      router.push(target)
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-muted p-10 lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            U
          </div>
          Ultimate CRM
        </div>
        <blockquote className="space-y-3 max-w-md">
          <p className="text-xl font-medium leading-relaxed">
            “Leads, team, invoices and WhatsApp — one workspace your whole
            company actually uses.”
          </p>
        </blockquote>
        <p className="text-sm text-muted-foreground">
          Production-grade · Built on Next.js 16
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-sm border-none shadow-none sm:border sm:shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your CRM workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit}>
              <FieldGroup>
                <Field data-invalid={error ? "" : undefined}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                </Field>
                <Field data-invalid={error ? "" : undefined}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={error ? true : undefined}
                    />
                  </InputGroup>
                  {error ? (
                    <FieldDescription className="text-destructive" role="alert">
                      {error}
                    </FieldDescription>
                  ) : null}
                </Field>

                <Field orientation="horizontal">
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? <Spinner data-icon="inline-start" /> : null}
                    Sign in
                    {!isPending ? <ArrowRightIcon data-icon="inline-end" /> : null}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
