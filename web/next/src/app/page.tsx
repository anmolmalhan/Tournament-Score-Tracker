import { redirect } from "next/navigation"

// Fresh fork: redirect to the waitlist until you build your real home page.
export default function Home() {
  redirect("/waitlist")
}
