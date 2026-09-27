'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ClerkProvider,
  useUser,
  useAuth as useClerkAuth,
  useOrganizationList,
  useClerk,
} from '@clerk/nextjs';
import { authClient } from '@/lib/auth-client';
import { isClerkEnabled } from '@/lib/auth-config';

export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface AppOrganization {
  id: string;
  name: string;
  slug: string;
  role?: string | null;
}

export interface AppAuthContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  isClerk: boolean;
  user: AppUser | null;
  session: {
    user: AppUser | null;
    session: {
      activeOrganizationId?: string | null;
    } | null;
  } | null;
  activeOrganizationId: string | null;
  organizations: AppOrganization[];
  setActiveOrganization: (orgId: string) => Promise<void>;
  createOrganization: (data: {
    name: string;
    slug: string;
  }) => Promise<{ id: string; name: string; slug: string } | null>;
  signOut: () => Promise<void>;
}

const AppAuthContext = createContext<AppAuthContextValue>({
  isLoaded: true,
  isSignedIn: false,
  isClerk: false,
  user: null,
  session: null,
  activeOrganizationId: null,
  organizations: [],
  setActiveOrganization: async () => {},
  createOrganization: async () => null,
  signOut: async () => {},
});

export function useAppAuth(): AppAuthContextValue {
  return useContext(AppAuthContext);
}

function ClerkAuthSync({ children }: { children: React.ReactNode }) {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { orgId } = useClerkAuth();
  const { userMemberships, setActive, createOrganization: clerkCreateOrg } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { signOut: clerkSignOut } = useClerk();

  const organizations: AppOrganization[] = (userMemberships?.data || []).map((mem) => ({
    id: mem.organization.id,
    name: mem.organization.name,
    slug: mem.organization.slug || mem.organization.id,
    role: mem.role,
  }));

  const appUser: AppUser | null = user
    ? {
        id: user.id,
        name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || 'User',
        email: user.primaryEmailAddress?.emailAddress || null,
        image: user.imageUrl || null,
      }
    : null;

  const activeOrgId =
    orgId || (user ? `clerk_${user.id.replace(/[^a-zA-Z0-9_-]/g, '_')}` : null);

  const session =
    isSignedIn && appUser
      ? {
          user: appUser,
          session: {
            activeOrganizationId: activeOrgId,
          },
        }
      : null;

  const setActiveOrganization = async (newOrgId: string) => {
    if (setActive) {
      await setActive({ organization: newOrgId });
      window.location.reload();
    }
  };

  const createOrganization = async (data: { name: string; slug: string }) => {
    if (clerkCreateOrg) {
      const created = await clerkCreateOrg({ name: data.name, slug: data.slug });
      if (setActive) {
        await setActive({ organization: created.id });
      }
      return {
        id: created.id,
        name: created.name,
        slug: created.slug || created.id,
      };
    }
    return null;
  };

  const signOut = async () => {
    await clerkSignOut();
    window.location.href = '/login';
  };

  const value: AppAuthContextValue = {
    isLoaded: Boolean(userLoaded && userMemberships?.isLoading === false),
    isSignedIn: Boolean(isSignedIn),
    isClerk: true,
    user: appUser,
    session,
    activeOrganizationId: activeOrgId,
    organizations,
    setActiveOrganization,
    createOrganization,
    signOut,
  };

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

function ClerkWrapper({ children }: { children: React.ReactNode }) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <div
        style={{
          padding: '2rem',
          margin: '2rem auto',
          maxWidth: '640px',
          fontFamily: 'system-ui, sans-serif',
          background: '#fff',
          borderRadius: '12px',
          border: '2px solid #ef4444',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        }}
      >
        <h2 style={{ color: '#dc2626', marginTop: 0 }}>Clerk Configuration Required</h2>
        <p style={{ color: '#374151', lineHeight: 1.6 }}>
          You have enabled Clerk authentication (<code>isclerk=true</code>), but{' '}
          <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> is not defined in your <code>.env</code>{' '}
          file.
        </p>
        <p style={{ color: '#374151', lineHeight: 1.6 }}>
          Please add your Clerk keys to <code>.env</code> or set <code>isclerk=false</code> to use
          Better Auth.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthSync>{children}</ClerkAuthSync>
    </ClerkProvider>
  );
}

function BetterAuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: sessionData, isPending } = authClient.useSession();
  const [organizations, setOrganizations] = useState<AppOrganization[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await authClient.organization.list();
        if (mounted && res?.data) {
          setOrganizations(
            (res.data as Array<{ id: string; name: string; slug: string }>).map((o) => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
            }))
          );
        }
      } catch {
        // session unavailable
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionData]);

  const activeOrgId =
    (sessionData?.session as { activeOrganizationId?: string | null })?.activeOrganizationId ||
    null;

  const appUser: AppUser | null = sessionData?.user
    ? {
        id: sessionData.user.id,
        name: sessionData.user.name,
        email: sessionData.user.email,
        image: sessionData.user.image,
      }
    : null;

  const session = sessionData
    ? {
        user: appUser,
        session: {
          activeOrganizationId: activeOrgId,
        },
      }
    : null;

  const setActiveOrganization = async (newOrgId: string) => {
    await authClient.organization.setActive({ organizationId: newOrgId });
    window.location.reload();
  };

  const createOrganization = async (data: { name: string; slug: string }) => {
    const res = await authClient.organization.create({
      name: data.name,
      slug: data.slug,
    });
    if (res?.data) {
      await authClient.organization.setActive({ organizationId: res.data.id });
      setOrganizations((prev) => [
        ...prev,
        { id: res.data!.id, name: res.data!.name, slug: res.data!.slug },
      ]);
      return {
        id: res.data.id,
        name: res.data.name,
        slug: res.data.slug,
      };
    }
    return null;
  };

  const signOut = async () => {
    await authClient.signOut();
    window.location.href = '/login';
  };

  const value: AppAuthContextValue = {
    isLoaded: !isPending,
    isSignedIn: Boolean(sessionData?.user),
    isClerk: false,
    user: appUser,
    session,
    activeOrganizationId: activeOrgId,
    organizations,
    setActiveOrganization,
    createOrganization,
    signOut,
  };

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isClerk = isClerkEnabled();

  if (isClerk) {
    return <ClerkWrapper>{children}</ClerkWrapper>;
  }

  return <BetterAuthWrapper>{children}</BetterAuthWrapper>;
}
