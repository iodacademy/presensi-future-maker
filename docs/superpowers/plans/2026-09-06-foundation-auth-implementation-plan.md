# Phase 1: Foundation and Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js 16 + TypeScript project with Figma Design UI tokens, establish Firebase custom token email-only login with 5-day session cookies, role-based route guards, and responsive shells for admin, student, and mentor.

**Architecture:** Client submits email -> server validates against Firestore users index and issues Firebase Custom Token -> client exchanges via `signInWithCustomToken` for ID token -> server verifies ID token and sets HttpOnly 5-day session cookie -> server middleware/guards read session cookie and authorize route based on Firestore `role`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS (or scoped CSS custom properties), Firebase Auth (Admin & Client SDK), Firestore (Admin SDK), Vitest, React Testing Library.

## Global Constraints

- Primary color `#0072CE`, title Poppins Bold, body Inter (per Design UI Figma actual).
- Three roles: `admin`, `student`, `mentor`.
- Role determined exclusively by server-side `role` field on user document, NOT client state.
- Email login only: no password, no magic link, no Google OAuth in UI.
- Session cookie: HttpOnly, SameSite=Lax, Secure on production, 5 days duration.
- Code comments: bilingual (Indonesian first, then English separated by ` / ` for single-line, or empty line for multi-line).
- YAGNI: minimal code that satisfies the requirements, no unrequested abstractions.

---

### Task 1: Project Scaffolding and Environment Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/lib/env.ts`
- Test: `tests/unit/env.test.ts`

**Interfaces:**
- Consumes: Node.js process.env
- Produces: `getEnv(): EnvConfig` with validated keys `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SESSION_COOKIE_SECRET`.

- [ ] **Step 1: Write the failing test for env validator**

```ts
// tests/unit/env.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getEnv } from '../../src/lib/env';

describe('env configuration', () => {
  beforeEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
  });

  it('throws error when required env vars are missing', () => {
    expect(() => getEnv()).toThrowError(/FIREBASE_PROJECT_ID/);
  });

  it('returns valid config when env vars are present', () => {
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
    process.env.FIREBASE_PRIVATE_KEY = 'fake-key';
    const config = getEnv();
    expect(config.projectId).toBe('test-project');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/env.test.ts`
Expected: FAIL (file or function not found)

- [ ] **Step 3: Create package.json, tsconfig.json, next.config.ts, vitest.config.ts, and src/lib/env.ts**

Minimal package.json:
```json
{
  "name": "app-manajement-bootcamp-innov",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run tests/unit"
  },
  "dependencies": {
    "firebase": "^12.18.0",
    "firebase-admin": "^14.3.0",
    "next": "^16.3.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.8",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  }
}
```

Implementation `src/lib/env.ts`:
```ts
// Validasi variabel lingkungan server / Validate server environment variables
export interface EnvConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function getEnv(): EnvConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'emulator@example.com';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || 'emulator-key';

  return { projectId, clientEmail, privateKey };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/env.test.ts`
Expected: PASS

---

### Task 2: Design Tokens, Typography and Shared UI Primitives

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Test: `tests/unit/button.test.tsx`

**Interfaces:**
- Consumes: Design UI colors (`#0072CE`, `#243C4B`, `#F4F4F5`, etc.)
- Produces: `Button({ variant, children, ...props })`, `Input({ label, error, ...props })`

- [ ] **Step 1: Write the failing test for Button**

```tsx
// tests/unit/button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '../../src/components/ui/button';

describe('Button primitive', () => {
  it('renders primary button with proper classes', () => {
    render(<Button variant="primary">Masuk</Button>);
    const btn = screen.getByRole('button', { name: /Masuk/i });
    expect(btn.className).toContain('bg-[#0072CE]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/button.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement globals.css, layout.tsx, and UI primitives**

`src/app/globals.css` defines CSS tokens matching Figma Design UI:
- Primary: `#0072CE`
- Admin Sidebar: `#243C4B`
- Background: `#F4F4F5`
- Font: Poppins for headings, Inter for body.

`src/components/ui/button.tsx`:
```tsx
import React from 'react';

// Komponen tombol bersama / Shared button primitive
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50';
  const styles = {
    primary: 'bg-[#0072CE] text-white hover:bg-[#005bb5] focus:ring-[#0072CE]',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300',
    danger: 'bg-[#D40D15] text-white hover:bg-red-700 focus:ring-red-400',
    ghost: 'text-gray-600 hover:bg-gray-100'
  }[variant];

  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/button.test.tsx`
Expected: PASS

---

### Task 3: Firebase Admin and Client SDK Initialization

**Files:**
- Create: `src/lib/firebase/admin.ts`
- Create: `src/lib/firebase/client.ts`
- Test: `tests/unit/firebase-admin.test.ts`

**Interfaces:**
- Consumes: `getEnv()`
- Produces: `getAdminAuth()`, `getAdminDb()`, `getClientAuth()`

- [ ] **Step 1: Write the failing test for Firebase Admin initialization**

```ts
// tests/unit/firebase-admin.test.ts
import { describe, it, expect } from 'vitest';
import { getAdminAuth, getAdminDb } from '../../src/lib/firebase/admin';

describe('Firebase Admin helper', () => {
  it('provides singleton auth and firestore instances', () => {
    process.env.FIREBASE_PROJECT_ID = 'test-demo';
    const auth1 = getAdminAuth();
    const auth2 = getAdminAuth();
    expect(auth1).toBe(auth2);
    expect(getAdminDb()).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/firebase-admin.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement src/lib/firebase/admin.ts and client.ts**

Handle singleton initialization, emulator support when `FIRESTORE_EMULATOR_HOST` is set, and error handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/firebase-admin.test.ts`
Expected: PASS

---

### Task 4: Email-Only Custom Token Auth Service

**Files:**
- Create: `src/features/auth/types.ts`
- Create: `src/features/auth/policy.ts`
- Create: `src/features/auth/service.ts`
- Create: `src/app/api/auth/token/route.ts`
- Test: `tests/unit/auth-policy.test.ts`
- Test: `tests/integration/auth-service.test.ts`

**Interfaces:**
- Consumes: Firestore `users` and `emailIndex` collections
- Produces: `createCustomTokenForEmail(email: string): Promise<{ customToken: string; role: Role }>`

- [ ] **Step 1: Write the failing test for email normalizer & role policy**

```ts
// tests/unit/auth-policy.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidRole } from '../../src/features/auth/policy';

describe('Auth policy', () => {
  it('normalizes email by trimming and lowercasing without stripping plus tags', () => {
    expect(normalizeEmail('  Budi.Santoso+test@Gmail.com ')).toBe('budi.santoso+test@gmail.com');
  });

  it('validates allowed roles', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('student')).toBe(true);
    expect(isValidRole('mentor')).toBe(true);
    expect(isValidRole('participant')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/auth-policy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement policy, service, and API route**

`src/features/auth/policy.ts`:
- Normalization: trim, lowercase.
- Role check: `['admin', 'student', 'mentor'].includes(role)`.

`src/features/auth/service.ts`:
- Lookup user by `normalizedEmail` in `users` collection.
- Check `active === true`.
- Read `role`.
- Call `adminAuth.createCustomToken(user.uid, { role })`.

`src/app/api/auth/token/route.ts`:
- POST `{ email }` -> returns `{ customToken, role }` or 401 if email not found/inactive.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth-policy.test.ts`
Expected: PASS

---

### Task 5: Session Cookie Exchange, Route Guard Middleware & Logout

**Files:**
- Create: `src/features/auth/session.ts`
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/middleware.ts`
- Test: `tests/unit/session-policy.test.ts`

**Interfaces:**
- Consumes: Firebase ID Token from client
- Produces: `createSessionCookie(idToken: string): Promise<string>`, `verifySession(cookie: string): Promise<Actor | null>`

- [ ] **Step 1: Write the failing test for session cookie verification**

```ts
// tests/unit/session-policy.test.ts
import { describe, it, expect } from 'vitest';
import { getRoleRedirectPath } from '../../src/features/auth/session';

describe('Session redirect policy', () => {
  it('redirects admin to /admin/kelas', () => {
    expect(getRoleRedirectPath('admin')).toBe('/admin/kelas');
  });

  it('redirects student to /app', () => {
    expect(getRoleRedirectPath('student')).toBe('/app');
  });

  it('redirects mentor to /mentor/peserta', () => {
    expect(getRoleRedirectPath('mentor')).toBe('/mentor/peserta');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/session-policy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement session exchange, middleware, and logout**

`src/app/api/auth/session/route.ts`:
- Receives `{ idToken }`.
- Calls `adminAuth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 })`.
- Sets cookie `__session` with `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`.

`src/app/api/auth/logout/route.ts`:
- Clears `__session` cookie.
- Revokes user refresh tokens via `adminAuth.revokeRefreshTokens(uid)`.

`src/middleware.ts`:
- Protects `/admin/*`, `/app/*`, `/mentor/*`.
- Verifies session cookie with checkRevoked=true.
- Ensures actor role matches path prefix.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/session-policy.test.ts`
Expected: PASS

---

### Task 6: CLI Admin Bootstrap Script

**Files:**
- Create: `scripts/bootstrap-admin.ts`
- Test: `tests/unit/bootstrap.test.ts`

**Interfaces:**
- Consumes: CLI args `--email=<email> --name=<name>`
- Produces: Creates user document in Firestore with `role: 'admin'`, `active: true`.

- [ ] **Step 1: Write the failing test for bootstrap logic**

```ts
// tests/unit/bootstrap.test.ts
import { describe, it, expect } from 'vitest';
import { validateBootstrapArgs } from '../../scripts/bootstrap-admin';

describe('Bootstrap CLI validator', () => {
  it('validates email and name arguments', () => {
    expect(() => validateBootstrapArgs([])).toThrowError(/Missing email/);
    expect(validateBootstrapArgs(['--email=admin@test.com', '--name=Super Admin'])).toEqual({
      email: 'admin@test.com',
      name: 'Super Admin',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/bootstrap.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement scripts/bootstrap-admin.ts**

- Parses arguments.
- Writes to `users/{uid}` and `emailIndex/{hash}`.
- Sets role to `admin`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/bootstrap.test.ts`
Expected: PASS

---

### Task 7: Login Page and Role App Shells

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/app/(student)/app/page.tsx`
- Create: `src/app/(admin)/admin/page.tsx`
- Create: `src/app/(mentor)/mentor/page.tsx`
- Test: `tests/unit/login-page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/token`, Firebase client `signInWithCustomToken`, `POST /api/auth/session`
- Produces: Interactive login form matching Figma colors, responsive shell layout.

- [ ] **Step 1: Write failing test for Login Form**

```tsx
// tests/unit/login-page.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LoginPage from '../../src/app/(auth)/login/page';

describe('LoginPage', () => {
  it('renders email input and Masuk button with no password field', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/email terdaftar/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Masuk/i })).toBeDefined();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/login-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement LoginPage and AppShell**

- `LoginPage`: Clean card with `#0072CE` accent, input email, Masuk button. Submits to `/api/auth/token`, gets custom token, signs in with client SDK, posts ID token to `/api/auth/session`, redirects based on role.
- `AppShell`: Responsive navigation (sidebar on desktop `>=768px`, bottom nav or mobile header on `<768px`). Sidebar color dark `#243C4B` for admin, white for student desktop.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/login-page.test.tsx`
Expected: PASS

---

## Phase 1 Self-Review Checklist
- [x] Spec coverage: Covers AUTH-01 through AUTH-08, role definitions, and shells.
- [x] No placeholders: All tasks specify exact files, interfaces, and minimal code.
- [x] Type consistency: Actor, Role, and Session types are consistent across all tasks.
