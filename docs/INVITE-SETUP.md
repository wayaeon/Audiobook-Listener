# Invite and Onboarding Setup

This guide covers Supabase configuration for the invite-only access flow and onboarding.

## 1. Run the schema

In Supabase SQL Editor, run the contents of `docs/supabase-schema.sql`. This creates:
- `profiles` – first name, last name, role (user/admin)
- `access_requests` – pre-login access requests
- Trigger to create a profile when a user signs up

## 2. Set your admin user

After your first user is created (e.g. via Supabase Dashboard → Authentication → Users), promote them to admin:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-email@example.com');
```

Replace `your-email@example.com` with your email.

## 3. Environment variables

Add to `.env.local` (see `.env.local.example`):

- `SUPABASE_SERVICE_ROLE_KEY` – From Supabase Dashboard → Project Settings → API → `service_role` key. **Never expose this to the client.**
- `NEXT_PUBLIC_SITE_URL` – Your app URL (e.g. `http://localhost:3000` or `https://yourapp.vercel.app`) for invite email redirect links.

## 4. Supabase Authentication settings

### Disable public sign-ups (invite only)

1. Supabase Dashboard → Authentication → Providers → Email
2. Turn **off** “Enable email signups” (or “Confirm email” as needed for your flow)

### Invite email template

1. Authentication → Email Templates → “Invite user”
2. Optionally customize the email text and subject
3. The `{{ .ConfirmationURL }}` in the template is the link users click to set their password

## 5. Flow summary

1. **Pre-login**: User visits `/`, sees landing page with hero image and “Request access” form.
2. **Request**: Form submits to `POST /api/access-requests` (no auth). Data is stored in `access_requests`.
3. **Admin**: Admin user opens Profile → “Access requests” → “Send invite” per row.
4. **Invite**: `POST /api/admin/invite` calls Supabase `inviteUserByEmail`. User receives email.
5. **Sign up**: User clicks link, sets password, is logged in.
6. **Onboarding**: New user is redirected to `/onboarding` to enter first and last name.
7. **App**: User is redirected to home and can use the app.
