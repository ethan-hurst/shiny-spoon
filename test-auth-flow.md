# TruthSource Authentication Testing Guide

## Setup Requirements

1. **Supabase Project**: Create a project at https://supabase.com
2. **Environment Variables**: Update `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. **Database Migration**: Run the migration from `supabase/migrations/001_initial_schema.sql` in Supabase SQL editor
4. **Email Templates** (Optional): Configure in Supabase Dashboard > Authentication > Email Templates

## Testing Steps

### 1. Test Sign Up Flow
- Navigate to `/signup`
- Fill in all fields:
  - Full Name: "Test User"
  - Organization Name: "Test Company"
  - Email: your-email@example.com
  - Password: TestPass123!
- Submit the form
- Check for success message about email confirmation
- Check Supabase Dashboard > Authentication > Users for new user
- Check `organizations` and `user_profiles` tables for created records

### 2. Test Login Flow
- Navigate to `/login`
- Enter credentials from signup
- Submit form
- Should redirect to `/dashboard` on success
- Should show error for invalid credentials

### 3. Test Protected Routes
- Clear browser cookies/storage to sign out
- Try accessing `/dashboard` directly
- Should redirect to `/login?redirectTo=/dashboard`
- After login, should redirect back to dashboard

### 4. Test Password Reset
- Navigate to `/reset-password`
- Enter registered email
- Submit form
- Check for success message
- If SMTP is configured, check email for reset link

### 5. Test Sign Out
- While logged in, use the user menu to sign out
- Should redirect to home page
- Try accessing `/dashboard` - should redirect to login

## Verification Checklist

- [ ] User can create account with organization
- [ ] User profile and organization are created in database
- [ ] User can log in with correct credentials
- [ ] Invalid credentials show error message
- [ ] Protected routes redirect when not authenticated
- [ ] Session persists on page refresh
- [ ] Sign out clears session properly
- [ ] Password reset sends email (if SMTP configured)

## Common Issues

1. **"Account setup incomplete"**: User exists but no profile - check if trigger is working
2. **Redirect loops**: Check middleware configuration
3. **Session not persisting**: Verify cookie settings and domain configuration
4. **Email not sending**: Check Supabase email settings or use local dev mode

## Next Steps

1. Configure email templates in Supabase Dashboard
2. Set up OAuth providers (Google, GitHub, etc.)
3. Implement role-based access control
4. Add user invitation flow
5. Set up email verification requirements