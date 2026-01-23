# Authentication Test Plan

Comprehensive test plan for all authentication features including test cases, UI/UX evaluation, and recommendations.

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Login Feature Tests](#2-login-feature-tests)
3. [Signup Feature Tests](#3-signup-feature-tests)
4. [Forgot Password Tests](#4-forgot-password-tests)
5. [Google OAuth Tests](#5-google-oauth-tests)
6. [Onboarding Tests](#6-onboarding-tests)
7. [Session & Route Protection Tests](#7-session--route-protection-tests)
8. [UI/UX Evaluation Checklist](#8-uiux-evaluation-checklist)
9. [Accessibility Tests](#9-accessibility-tests)
10. [Performance Tests](#10-performance-tests)
11. [Security Tests](#11-security-tests)
12. [Known Issues & Recommendations](#12-known-issues--recommendations)

---

## 1. Test Environment Setup

### Prerequisites
- Node.js 20+
- pnpm installed
- Supabase project configured
- Google OAuth credentials (for OAuth testing)
- Test email accounts

### Test URLs
| Environment | URL |
|-------------|-----|
| Development | http://localhost:3000 |
| Production | https://pms-nine-gold.vercel.app |

### Test Accounts
| Type | Email | Password | Notes |
|------|-------|----------|-------|
| New User | test-new@example.com | TestPass123! | For signup tests |
| Existing User | test-existing@example.com | TestPass123! | For login tests |
| No Org User | test-no-org@example.com | TestPass123! | For onboarding tests |

---

## 2. Login Feature Tests

### 2.1 Form Validation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| L-001 | Empty email validation | 1. Navigate to /login<br>2. Leave email empty<br>3. Click Sign in | Error: "Email is required" | [ ] |
| L-002 | Invalid email format | 1. Enter "invalid-email"<br>2. Tab to next field | Error: "Please enter a valid email address" | [ ] |
| L-003 | Empty password validation | 1. Enter valid email<br>2. Leave password empty<br>3. Click Sign in | Error: "Password is required" | [ ] |
| L-004 | Password too short | 1. Enter valid email<br>2. Enter "1234567" (7 chars)<br>3. Tab out | Error: "Password must be at least 8 characters" | [ ] |
| L-005 | Password exactly 8 chars | 1. Enter valid email<br>2. Enter "12345678" | No error, form valid | [ ] |
| L-006 | All fields empty submit | 1. Click Sign in without filling | Both email and password errors shown | [ ] |

### 2.2 Authentication Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| L-007 | Valid credentials login | 1. Enter valid email<br>2. Enter valid password<br>3. Click Sign in | Redirect to dashboard | [ ] |
| L-008 | Invalid email (not registered) | 1. Enter unregistered email<br>2. Enter any password<br>3. Click Sign in | Error message displayed | [ ] |
| L-009 | Invalid password | 1. Enter registered email<br>2. Enter wrong password<br>3. Click Sign in | Error: "Invalid login credentials" | [ ] |
| L-010 | Case sensitivity - email | 1. Enter email with different case<br>2. Enter correct password | Should login successfully (emails are case-insensitive) | [ ] |
| L-011 | Whitespace in email | 1. Enter " email@test.com "<br>2. Enter password | Should trim and login | [ ] |

### 2.3 UI State Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| L-012 | Button disabled when invalid | 1. Open login page<br>2. Check button state | Button should be disabled | [ ] |
| L-013 | Button enabled when valid | 1. Fill valid email<br>2. Fill valid password | Button should be enabled | [ ] |
| L-014 | Loading state on submit | 1. Fill valid credentials<br>2. Click Sign in | Button text: "Signing in...", inputs disabled | [ ] |
| L-015 | Error from URL param | 1. Navigate to /login?error=Test%20error | "Test error" displayed in error box | [ ] |
| L-016 | Google button disabled during load | 1. Click Sign in<br>2. Check Google button | Google button should be disabled | [ ] |

### 2.4 Navigation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| L-017 | Forgot password link | 1. Click "Forgot password?" | Navigate to /forgot-password | [ ] |
| L-018 | Sign up link | 1. Click "Sign up" in footer | Navigate to /signup | [ ] |
| L-019 | Already logged in access | 1. Login successfully<br>2. Navigate to /login | Redirect to dashboard | [ ] |

---

## 3. Signup Feature Tests

### 3.1 Form Validation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| S-001 | Empty full name | 1. Leave name empty<br>2. Fill other fields | Error: "Full name is required" | [ ] |
| S-002 | Name too short | 1. Enter "A" (1 char)<br>2. Tab out | Error: "Full name must be at least 2 characters" | [ ] |
| S-003 | Name exactly 2 chars | 1. Enter "Jo" | No error | [ ] |
| S-004 | Empty email | 1. Fill name<br>2. Leave email empty | Error: "Email is required" | [ ] |
| S-005 | Invalid email format | 1. Enter "not-an-email" | Error: "Please enter a valid email address" | [ ] |
| S-006 | Empty password | 1. Fill name and email<br>2. Leave password empty | Error: "Password is required" | [ ] |
| S-007 | Password hint displayed | 1. Focus on password field | "Must be at least 8 characters" shown below | [ ] |
| S-008 | Password too short | 1. Enter "1234567" | Error: "Password must be at least 8 characters" | [ ] |

### 3.2 Registration Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| S-009 | Successful registration | 1. Fill all valid fields<br>2. Click Create account | Account created, redirect to dashboard | [ ] |
| S-010 | Personal workspace created | 1. Complete signup<br>2. Check organizations | "[Name]'s Workspace" exists | [ ] |
| S-011 | User is admin of workspace | 1. Complete signup<br>2. Check org membership | User has "admin" role | [ ] |
| S-012 | Duplicate email | 1. Use already registered email<br>2. Submit | Error: "User already registered" or similar | [ ] |
| S-013 | Special chars in name | 1. Enter "John O'Brien-Smith"<br>2. Complete signup | Account created, name preserved | [ ] |
| S-014 | Unicode in name | 1. Enter "?????"<br>2. Complete signup | Account created with Unicode name | [ ] |
| S-015 | Very long name | 1. Enter 200+ character name | Should accept or show limit error | [ ] |

### 3.3 UI State Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| S-016 | Loading state | 1. Fill valid data<br>2. Click Create account | "Creating account...", inputs disabled | [ ] |
| S-017 | Google button during load | 1. Click Create account | Google button disabled | [ ] |

### 3.4 Navigation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| S-018 | Sign in link | 1. Click "Sign in" in footer | Navigate to /login | [ ] |
| S-019 | Already logged in access | 1. Be logged in<br>2. Navigate to /signup | Redirect to dashboard | [ ] |

---

## 4. Forgot Password Tests

### 4.1 Form Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FP-001 | Empty email submit | 1. Click Send reset link without email | HTML5 validation: "Please fill out this field" | [ ] |
| FP-002 | Invalid email format | 1. Enter "invalid"<br>2. Submit | HTML5 validation or error message | [ ] |
| FP-003 | Valid email submit | 1. Enter registered email<br>2. Click Send reset link | Success message displayed | [ ] |
| FP-004 | Unregistered email | 1. Enter non-existent email<br>2. Submit | Should still show success (security) | [ ] |

### 4.2 UI State Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FP-005 | Loading state | 1. Submit form | Button shows loading state | [ ] |
| FP-006 | Success state UI | 1. Submit valid email | "Check your email" message, back to login link | [ ] |

### 4.3 Navigation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FP-007 | Back to login link | 1. Click "Back to login" | Navigate to /login | [ ] |
| FP-008 | Post-success login link | 1. Submit email<br>2. Click "Back to login" | Navigate to /login | [ ] |

### 4.4 Email Flow Tests (Manual)

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| FP-009 | Reset email received | 1. Request reset<br>2. Check email | Email received with reset link | [ ] |
| FP-010 | Reset link works | 1. Click link in email | Redirected to reset password page | [ ] |
| FP-011 | Password updated | 1. Enter new password<br>2. Submit | Password changed, can login with new | [ ] |
| FP-012 | Expired reset link | 1. Wait for link expiry<br>2. Click link | Error: link expired | [ ] |

---

## 5. Google OAuth Tests

### 5.1 OAuth Flow Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| O-001 | Initiate OAuth | 1. Click "Continue with Google" | Redirect to Google consent screen | [ ] |
| O-002 | Successful OAuth - new user | 1. Complete Google flow<br>2. First time user | Account created, personal workspace created | [ ] |
| O-003 | Successful OAuth - existing user | 1. Complete Google flow<br>2. Returning user | Logged in, redirect to dashboard | [ ] |
| O-004 | OAuth cancelled | 1. Click Google button<br>2. Cancel on Google screen | Redirect to /login with error | [ ] |
| O-005 | OAuth error | 1. Simulate OAuth error | Redirect to /login?error=... | [ ] |

### 5.2 Callback Handler Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| O-006 | Valid callback with code | 1. Complete OAuth<br>2. Callback with code param | Session created, redirect to dashboard | [ ] |
| O-007 | Callback with error param | 1. Navigate to /auth/callback?error=test | Redirect to /login?error=test | [ ] |
| O-008 | Callback without params | 1. Navigate to /auth/callback directly | Redirect to /login?error=Invalid... | [ ] |
| O-009 | Callback with next param | 1. OAuth from protected route<br>2. Complete flow | Redirect to original route | [ ] |

### 5.3 Auto-Organization Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| O-010 | First OAuth creates org | 1. New user OAuth | "[Name]'s Workspace" created | [ ] |
| O-011 | Returning user no new org | 1. Existing user OAuth | No new org created | [ ] |
| O-012 | OAuth user is org admin | 1. Check new user's org role | Role is "admin" | [ ] |
| O-013 | Name from Google profile | 1. OAuth with Google account | Org name uses Google display name | [ ] |

---

## 6. Onboarding Tests

### 6.1 Access Control Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| OB-001 | Unauthenticated access | 1. Logout<br>2. Navigate to /onboarding | Redirect to /login | [ ] |
| OB-002 | User with org access | 1. Login with org<br>2. Navigate to /onboarding | Redirect to dashboard or allowed | [ ] |
| OB-003 | User without org access | 1. Login without org<br>2. Check redirect | Should be on /onboarding | [ ] |

### 6.2 Form Validation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| OB-004 | Empty org name | 1. Leave name empty<br>2. Submit | HTML5 validation error | [ ] |
| OB-005 | Org name too short | 1. Enter "A"<br>2. Submit | Error: minimum 2 characters | [ ] |
| OB-006 | Valid org name | 1. Enter "My Company"<br>2. Submit | Organization created | [ ] |

### 6.3 Organization Creation Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| OB-007 | Org created successfully | 1. Enter valid name<br>2. Submit | Org exists in database | [ ] |
| OB-008 | Slug generated | 1. Enter "My Test Org"<br>2. Submit | Slug: "my-test-org" | [ ] |
| OB-009 | Slug uniqueness | 1. Create "Test Org"<br>2. Create another "Test Org" | Second gets "test-org-1" or similar | [ ] |
| OB-010 | User becomes admin | 1. Create org<br>2. Check membership | User is admin | [ ] |
| OB-011 | Special chars in name | 1. Enter "Acme & Co."<br>2. Submit | Created, slug sanitized | [ ] |
| OB-012 | Redirect after creation | 1. Create org | Redirect to dashboard (/) | [ ] |

---

## 7. Session & Route Protection Tests

### 7.1 Protected Routes

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RP-001 | Dashboard access - logged out | 1. Logout<br>2. Navigate to / | Redirect to /login | [ ] |
| RP-002 | Projects access - logged out | 1. Navigate to /projects | Redirect to /login | [ ] |
| RP-003 | Tasks access - logged out | 1. Navigate to /tasks | Redirect to /login | [ ] |
| RP-004 | Clients access - logged out | 1. Navigate to /clients | Redirect to /login | [ ] |
| RP-005 | Settings access - logged out | 1. Navigate to /settings | Redirect to /login | [ ] |

### 7.2 Auth Pages When Logged In

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RP-006 | Login page - logged in | 1. Login<br>2. Navigate to /login | Redirect to dashboard | [ ] |
| RP-007 | Signup page - logged in | 1. Login<br>2. Navigate to /signup | Redirect to dashboard | [ ] |

### 7.3 Session Management

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RP-008 | Sign out | 1. Click sign out | Session cleared, redirect to /login | [ ] |
| RP-009 | Session persistence | 1. Login<br>2. Close browser<br>3. Reopen | Still logged in | [ ] |
| RP-010 | Multiple tabs | 1. Open app in 2 tabs<br>2. Logout in one | Both tabs should logout | [ ] |
| RP-011 | Expired session | 1. Let session expire<br>2. Try action | Redirect to login | [ ] |

---

## 8. UI/UX Evaluation Checklist

### 8.1 Visual Design

| Item | Check | Notes |
|------|-------|-------|
| Consistent branding | [ ] | Logo, colors, typography |
| Form alignment | [ ] | Labels, inputs, buttons aligned |
| Error message styling | [ ] | Red/destructive color, clear visibility |
| Success message styling | [ ] | Green/positive indication |
| Loading indicators | [ ] | Spinners or text changes |
| Button states | [ ] | Hover, active, disabled states |
| Input focus states | [ ] | Clear focus ring/outline |
| Dark mode support | [ ] | All auth pages work in dark mode |
| Mobile responsiveness | [ ] | Forms usable on mobile |
| Card shadows/borders | [ ] | Consistent elevation |

### 8.2 Interaction Design

| Item | Check | Notes |
|------|-------|-------|
| Tab order logical | [ ] | Name > Email > Password > Button |
| Enter key submits | [ ] | Can submit with Enter |
| Escape key behavior | [ ] | Closes modals if any |
| Password visibility toggle | [ ] | Should have show/hide option |
| Auto-focus on load | [ ] | First field focused |
| Error field focus | [ ] | Focus moves to error field |
| Clear error on edit | [ ] | Errors clear when user types |

### 8.3 Feedback & Communication

| Item | Check | Notes |
|------|-------|-------|
| Error messages clear | [ ] | User knows what to fix |
| Success feedback | [ ] | User knows action succeeded |
| Loading feedback | [ ] | User knows system is working |
| Validation timing | [ ] | Errors shown at right time |
| Help text present | [ ] | Password requirements shown |

### 8.4 Potential UI/UX Issues to Look For

| Issue | Description | Priority |
|-------|-------------|----------|
| No password visibility toggle | Users can't verify password | High |
| No password strength indicator | No feedback on password quality | Medium |
| Error messages too technical | Supabase errors shown raw | High |
| No remember me option | Always need to re-login | Low |
| No social login options besides Google | Limited OAuth providers | Low |
| Form doesn't remember email | After error, form clears | Medium |
| No loading skeleton | Page flash on load | Low |
| Success message timing | May disappear too fast | Medium |

---

## 9. Accessibility Tests

### 9.1 Keyboard Navigation

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| A-001 | Tab through all elements | All interactive elements focusable | [ ] |
| A-002 | Enter submits form | Form submits on Enter | [ ] |
| A-003 | Focus visible | Focus ring visible on all elements | [ ] |
| A-004 | Skip links | Skip to main content available | [ ] |

### 9.2 Screen Reader

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| A-005 | Form labels | All inputs have labels | [ ] |
| A-006 | Error announcements | Errors announced to screen reader | [ ] |
| A-007 | Button text | Buttons have meaningful text | [ ] |
| A-008 | Page titles | Each page has descriptive title | [ ] |
| A-009 | ARIA labels | Interactive elements have aria-labels | [ ] |

### 9.3 Visual

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| A-010 | Color contrast | Text meets WCAG AA (4.5:1) | [ ] |
| A-011 | Text scalable | UI works at 200% zoom | [ ] |
| A-012 | No color-only info | Errors not just red, have icon/text | [ ] |

---

## 10. Performance Tests

### 10.1 Load Times

| ID | Test Case | Target | Status |
|----|-----------|--------|--------|
| P-001 | Login page load | < 2s | [ ] |
| P-002 | Signup page load | < 2s | [ ] |
| P-003 | Auth action response | < 3s | [ ] |
| P-004 | OAuth redirect | < 2s | [ ] |
| P-005 | Session check | < 500ms | [ ] |

### 10.2 Network

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| P-006 | Slow 3G login | Form submits, shows loading | [ ] |
| P-007 | Offline handling | Appropriate error message | [ ] |
| P-008 | Request timeout | Timeout error shown | [ ] |

---

## 11. Security Tests

### 11.1 Input Validation

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| SEC-001 | SQL injection in email | Input sanitized, no error | [ ] |
| SEC-002 | XSS in name field | Script not executed | [ ] |
| SEC-003 | Very long inputs | Handled gracefully | [ ] |

### 11.2 Authentication Security

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| SEC-004 | Brute force protection | Rate limiting after failed attempts | [ ] |
| SEC-005 | Password not in URL | Password never in query params | [ ] |
| SEC-006 | Secure cookies | HttpOnly, Secure, SameSite flags | [ ] |
| SEC-007 | HTTPS enforced | All auth over HTTPS | [ ] |
| SEC-008 | CSRF protection | Forms protected against CSRF | [ ] |

### 11.3 Session Security

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| SEC-009 | Session fixation | New session ID after login | [ ] |
| SEC-010 | Session timeout | Sessions expire appropriately | [ ] |
| SEC-011 | Logout invalidates session | Old tokens don't work | [ ] |

---

## 12. Known Issues & Recommendations

### 12.1 Identified Issues

| ID | Issue | Severity | Location | Recommendation |
|----|-------|----------|----------|----------------|
| I-001 | No password visibility toggle | Medium | Login/Signup forms | Add eye icon to toggle password visibility |
| I-002 | No password strength meter | Low | Signup form | Add visual indicator for password strength |
| I-003 | Raw Supabase errors shown | High | All forms | Map Supabase errors to user-friendly messages |
| I-004 | No "Remember me" checkbox | Low | Login form | Add option to extend session duration |
| I-005 | Form clears on error | Medium | Signup form | Preserve form data on validation error |
| I-006 | No email confirmation step | Medium | Signup | Consider email verification before dashboard |
| I-007 | Inconsistent validation timing | Low | Forms | Standardize when errors appear (onChange vs onBlur) |
| I-008 | No loading skeleton | Low | Auth pages | Add skeleton while checking auth state |
| I-009 | OAuth error messages unclear | Medium | Callback | Provide clearer OAuth failure messages |
| I-010 | No password requirements shown | Medium | Login | Show requirements when password invalid |

### 12.2 UI/UX Enhancement Recommendations

#### High Priority

1. **Add Password Visibility Toggle**
   - Add show/hide button in password fields
   - Improves usability significantly
   - Standard UX pattern users expect

2. **Improve Error Messages**
   - Create error message mapping:
     ```typescript
     const errorMessages = {
       'Invalid login credentials': 'The email or password you entered is incorrect.',
       'User already registered': 'An account with this email already exists. Try signing in instead.',
       'Email not confirmed': 'Please check your email to confirm your account.',
     }
     ```

3. **Preserve Form Data on Error**
   - Don't clear email/name on validation errors
   - Only clear password on auth failures

#### Medium Priority

4. **Add Password Strength Indicator**
   - Show strength: Weak, Fair, Strong
   - Visual progress bar
   - Tips for improvement

5. **Add Loading Skeletons**
   - Replace flash of content with skeletons
   - Better perceived performance

6. **Improve OAuth Error Handling**
   - Map OAuth errors to friendly messages
   - Provide recovery actions

#### Low Priority

7. **Add "Remember Me" Option**
   - Checkbox on login form
   - Extends session duration

8. **Add More OAuth Providers**
   - GitHub, Microsoft, Apple
   - Depends on user base needs

9. **Add 2FA Support**
   - Optional two-factor authentication
   - TOTP or SMS-based

### 12.3 Code Quality Recommendations

1. **Standardize Form Handling**
   - All forms should use React Hook Form + Zod
   - Forgot password currently uses native form

2. **Consistent Error Display Component**
   - Create reusable `<FormError message={error} />` component
   - Currently inline styles repeated

3. **Centralize Auth Redirects**
   - Create constants for auth routes
   - Avoid hardcoded paths

4. **Add Form Analytics**
   - Track form abandonment
   - Track error frequencies

---

## Test Execution Tracking

### Summary

| Category | Total | Passed | Failed | Blocked | Not Run |
|----------|-------|--------|--------|---------|---------|
| Login | 19 | | | | 19 |
| Signup | 19 | | | | 19 |
| Forgot Password | 12 | | | | 12 |
| OAuth | 13 | | | | 13 |
| Onboarding | 12 | | | | 12 |
| Route Protection | 11 | | | | 11 |
| Accessibility | 12 | | | | 12 |
| Performance | 8 | | | | 8 |
| Security | 11 | | | | 11 |
| **Total** | **117** | | | | **117** |

### Test Execution Notes

_Record test execution notes, environment details, and issues found here during testing._

---

## Appendix

### A. Test Data

```
Valid Email: test@example.com
Invalid Emails:
  - "invalid"
  - "no@domain"
  - "@nodomain.com"
  - "spaces in@email.com"

Valid Password: TestPass123!
Invalid Passwords:
  - "" (empty)
  - "1234567" (7 chars)
  - "        " (8 spaces)

Valid Names:
  - "Jo" (2 chars min)
  - "John Doe"
  - "John O'Brien-Smith"

Invalid Names:
  - "" (empty)
  - "A" (1 char)
```

### B. Error Message Reference

| Supabase Error | User-Friendly Message |
|----------------|----------------------|
| Invalid login credentials | The email or password you entered is incorrect. Please try again. |
| User already registered | An account with this email already exists. Please sign in instead. |
| Email not confirmed | Please check your email and click the confirmation link to activate your account. |
| Password should be at least 6 characters | Please choose a password with at least 8 characters. |
| Unable to validate email address | Please enter a valid email address. |

### C. Related Files

| File | Description |
|------|-------------|
| `/app/(auth)/login/page.tsx` | Login page component |
| `/app/(auth)/signup/page.tsx` | Signup page component |
| `/app/(auth)/forgot-password/page.tsx` | Password reset request |
| `/app/auth/callback/route.ts` | OAuth callback handler |
| `/app/onboarding/page.tsx` | Organization onboarding |
| `/lib/actions/auth.ts` | Auth server actions |
| `/middleware.ts` | Route protection |
| `/hooks/use-auth.ts` | Auth state hook |
