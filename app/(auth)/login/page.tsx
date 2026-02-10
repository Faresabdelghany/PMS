import type { Metadata } from "next"
import LoginFormWrapper from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Sign In - PMS",
}

export default function LoginPage() {
  return <LoginFormWrapper />
}
