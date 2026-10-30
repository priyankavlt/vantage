'use client';

import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/** Talks to better-auth through the same-origin `/api/auth` proxy. */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
