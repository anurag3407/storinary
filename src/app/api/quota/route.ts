import { NextRequest, NextResponse } from 'next/server';
import { authorizeDashboardOrReadApiKey } from '@/lib/media-auth';
import { getAccountStorageUsage, ACCOUNT_STORAGE_LIMIT_BYTES } from '@/lib/quota';

export const runtime = 'nodejs';

/**
 * GET /api/quota — Retrieve the active account's storage usage, 100 MB free tier quota,
 * and SaaS plan details.
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeDashboardOrReadApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const quota = await getAccountStorageUsage(auth.organizationId);

    const plans = [
      {
        id: 'free',
        name: 'Free Developer Tier',
        storageLimit: '100 MB',
        storageLimitBytes: ACCOUNT_STORAGE_LIMIT_BYTES,
        price: '$0',
        billing: 'Forever Free',
        current: true,
        features: [
          '100 MB High-Speed Cloud Storage',
          'Real-Time Image Transformations (Resize, Crop, WebP/AVIF, Fill)',
          'Background Removal & AI Moderation',
          'Multi-Tenant Workspace Isolation',
          'Full REST API & SDK Access',
          'Global Edge CDN Delivery',
        ],
      },
      {
        id: 'pro',
        name: 'Pro Developer',
        storageLimit: '50 GB',
        storageLimitBytes: 50 * 1024 * 1024 * 1024,
        price: '$19',
        billing: 'per month',
        current: false,
        status: 'coming_soon',
        features: [
          '50 GB High-Speed Cloud Storage',
          'Custom CDN Domains & CNAME',
          'Priority AI Background Removal & Moderation',
          'Adaptive Bitrate Video Transcoding (HLS & DASH)',
          'Team Workspaces & Role-Based Access Control',
          'Dedicated Webhook Delivery Guarantees',
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise Scale',
        storageLimit: 'Unlimited',
        storageLimitBytes: -1,
        price: 'Custom',
        billing: 'annual contract',
        current: false,
        status: 'coming_soon',
        features: [
          'Unlimited Cloud Storage',
          '99.99% Uptime SLA',
          'Dedicated Isolated Storage Cluster',
          'Custom Retention Policies & Audit Logs',
          '24/7 Priority Support & Integration Assistance',
        ],
      },
    ];

    return NextResponse.json({
      success: true,
      quota,
      plans,
      paymentStatus: 'Payment processing via Stripe/Razorpay coming soon. All accounts enjoy 100 MB free storage.',
    });
  } catch (error) {
    console.error('Error fetching account quota:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve storage quota' },
      { status: 500 }
    );
  }
}
