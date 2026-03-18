# InMobi Accelerate — Agent Contributions

Built by Claude (Anthropic) — 2026-03-18

## Summary

Customized the `achromatic-pro` Next.js 15 monorepo theme into the InMobi Accelerate platform. Focused on: Auth + Onboarding flow.

---

## Files Created

### New Components
- `apps/dashboard/components/auth/sign-up/sign-up-card.tsx` — Fully rebuilt sign-up card: firstName/lastName, phone code picker (searchable dropdown, default +91), phone, email, businessUrl, password, T&C checkbox (disables Sign Up button), removes Google/Microsoft OAuth
- `apps/dashboard/components/onboarding/onboarding-brand-agent-step.tsx` — Full-screen branded loading step (3s mock Brand Agent analysis)
- `apps/dashboard/components/onboarding/onboarding-business-step.tsx` — Step 1 of 2 onboarding: org card with auto-prefilled mock data (Business Name, Contact Email, Location dropdown, Category dropdown), Save button, "+ Add another business" link, CTA
- `apps/dashboard/components/onboarding/onboarding-connectors-step.tsx` — Step 2 of 2 onboarding: platform connectors (Google mock-connected, Meta/Microsoft/Shopify connect buttons)
- `apps/dashboard/components/onboarding/ad-account-modal.tsx` — Modal with 3 mock ad accounts (radio selection), Confirm button
- `apps/dashboard/components/accelera-ai/accelera-ai-home.tsx` — Accelera AI placeholder page with greeting, disabled input, 3 quick action buttons
- `apps/dashboard/app/organizations/[slug]/(organization)/accelera-ai/page.tsx` — Server page for Accelera AI home

### Environment Files
- `apps/dashboard/.env` — Dashboard env (SendGrid, Postgres, Auth secret)
- `apps/marketing/.env` — Marketing env
- `apps/public-api/.env` — Public API env
- `packages/database/.env` — Database connection string

### Docker
- `docker-compose.yml` — Postgres 16, Redis 7, pgAdmin4

---

## Files Modified

### Branding
- `packages/common/src/app.ts` — APP_NAME = 'InMobi Accelerate', APP_DESCRIPTION updated
- `packages/ui/src/components/logo.tsx` — New Accelerate logo: "inmobi" (muted, small) above "accelerate" (blue, bold)

### Auth
- `packages/auth/src/constants.ts` — EMAIL_VERIFICATION_EXPIRY_HOURS = 72, PASSWORD_RESET_EXPIRY_HOURS = 72
- `packages/auth/src/events.ts` — Updates isFirstLogin=false on sign-in
- `packages/auth/src/permissions.ts` — isOrganizationMember now returns `role !== ADMIN` (MEMBER enum removed)
- `apps/dashboard/components/auth/sign-in/sign-in-card.tsx` — Removed Google/Microsoft OAuth buttons and "Or continue with" divider

### Sign Up
- `apps/dashboard/schemas/auth/sign-up-schema.ts` — New fields: firstName, lastName, phoneCode, phone, businessUrl, termsAccepted; validation rules per spec
- `apps/dashboard/actions/auth/sign-up.ts` — Saves firstName, lastName, phoneCode, phone, businessUrl, isFirstLogin=true
- `apps/dashboard/app/auth/sign-up/page.tsx` — Simplified (T&C moved into card)

### Email
- `packages/email/src/provider/index.ts` — Switched to SendGrid provider
- `packages/email/src/send-verify-email-address-email.ts` — Subject: "You're in. One click to activate Accelerate"
- `packages/email/src/send-password-reset-email.ts` — Subject: "Reset your Accelerate password"
- `packages/email/src/templates/verify-email-address-email.tsx` — Accelerate branding: blue header, "Get Started" CTA button, 72hr expiry note
- `packages/email/src/templates/password-reset-email.tsx` — Accelerate branding: blue header, "Reset Password" CTA button, 72hr expiry note

### Database (Prisma)
- `packages/database/prisma/schema.prisma`:
  - Role enum: replaced MEMBER with MARKETER, ANALYST, FINANCE, DEVELOPER (keeping ADMIN)
  - User model: added firstName, lastName, phoneCode, businessUrl, isFirstLogin fields
  - Organization model: added contactEmail, location, category, businessUrl, logoUrl fields
  - Added ConnectedAdAccount model (platform, accountId, accountName, status, etc.)
  - Updated Invitation/Membership default role from MEMBER to MARKETER

### Onboarding
- `apps/dashboard/schemas/onboarding/complete-onboarding-schema.ts` — Added OnboardingStep enum values: BrandAgentLoading, Business, Connectors; added businessOnboardingSchema, connectorsOnboardingSchema
- `apps/dashboard/components/onboarding/onboarding-wizard.tsx` — Added new Accelerate steps, full-screen treatment for BrandAgentLoading step
- `apps/dashboard/app/onboarding/page.tsx` — New Accelerate onboarding flow: [BrandAgentLoading, Business, Connectors]
- `apps/dashboard/actions/onboarding/complete-onboarding.ts` — Added handleAccelerateBusinessStep, redirect to AcceleraAi route after Business step

### Routes
- `packages/routes/src/index.ts` — Added AcceleraAi route

### Labels / Role fixes
- `apps/dashboard/lib/labels.ts` — roleLabels updated for new Role enum
- `apps/dashboard/components/onboarding/onboarding-invite-team-step.tsx` — Role.MEMBER → Role.MARKETER
- `apps/dashboard/components/organizations/slug/settings/organization/members/invite-member-modal.tsx` — Default role MEMBER → MARKETER, permission check updated
- `apps/dashboard/components/organizations/slug/settings/organization/members/change-role-modal.tsx` — Permission check updated
- `apps/dashboard/components/organizations/slug/settings/organization/members/edit-invitation-modal.tsx` — Permission check updated

---

## What Still Needs to Be Done

### First-time setup (one-time)
```bash
# 1. Start Docker containers
cd /Users/abhinav.negi/Documents/Accelerate
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client + run migrations
pnpm --filter @workspace/database exec prisma migrate dev --name accelerate-init

# 4. Start dashboard
pnpm --filter dashboard dev
```

### Remaining work (not in scope for this session)
- Real Brand Agent integration (currently 3-second mock)
- Real OAuth for ad account connections (Google Ads, Meta, Microsoft Ads, Shopify APIs)
- isFirstLogin check on the dashboard to redirect through onboarding vs. Accelera AI
- Sidebar navigation updates (add Accelera AI link)
- SendGrid email template previews verification
- Production env vars (real AUTH_SECRET, etc.)
- Stripe/billing configuration if needed

---

## Notes / Issues Found
- The `Role` enum change from MEMBER → MARKETER is a **breaking migration**. The Prisma migration will need to handle existing data (if any).
- The `onboarding/user` page (for users with pending invitations) still uses old onboarding wizard — not changed since it's out of scope.
- The Accelera AI page route is `/organizations/[slug]/accelera-ai` — requires org context.
