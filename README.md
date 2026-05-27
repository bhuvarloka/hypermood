This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## End-to-end tests

```bash
pnpm exec playwright install chromium   # one-time, downloads the browser
cp .env.test.local.example .env.test.local
# Fill in only: TEST_USER_EMAIL, TEST_ROLL_ID, TEST_PUBLIC_GALLERY_SLUG.
# No secrets go in .env.test.local — Supabase URL + keys are read from .env.local.
# Auth uses the service-role key (from .env.local) to mint a session (no OTP needed).
pnpm test:e2e
```

> ⚠️ **`test-results/` and `tests/e2e/.auth/user.json` contain a real Supabase
> session** (live access + refresh tokens for the test account). They are
> gitignored — never zip, attach, or share them. The `setup` project runs with
> tracing off so the session never lands in a trace.zip.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
