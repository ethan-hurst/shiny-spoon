// Type declarations for Deno runtime in Supabase Edge Functions
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined
    }
    serve(handler: (req: Request) => Response | Promise<Response>): void
  }
}

export {}
