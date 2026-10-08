'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { CheckIcon, SparklesIcon, ZapIcon } from '@/components/ui/icons';
import styles from './UpgradeModal.module.css';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsageFormatted?: string;
  planName?: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  currentUsageFormatted = '0 B',
  planName = 'Free Developer Tier',
}: UpgradeModalProps) {
  const { toast } = useToast();
  const [joined, setJoined] = useState(false);
  const isPro = Boolean(planName?.toLowerCase().includes('pro'));

  const handleJoinPro = () => {
    setJoined(true);
    toast.success('Thank you! You have been prioritized for the Pro Plan rollout.');
  };

  const handleContactEnterprise = () => {
    window.location.href = 'mailto:sayalabs.studio@gmail.com?subject=Storinary Enterprise Inquiry';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Storinary Cloud Plans & Storage"
    >
      <div className={styles.noticeBanner}>
        <span className={styles.noticeIcon}>
          <SparklesIcon size={20} />
        </span>
        <div>
          <strong>SaaS Payment Integration in Progress:</strong> Payment gateway integration
          (Stripe & Razorpay) is currently being finalized. Every account is allocated a{' '}
          <strong>100 MB free quota</strong> with full access to transformations, API keys, and CDN delivery.
        </div>
      </div>

      <div className={styles.tiersGrid}>
        {/* Free Plan */}
        <div className={`${styles.tierCard} ${!isPro ? styles.tierCardActive : ''}`}>
          {!isPro && <span className={`${styles.tierBadge} ${styles.tierBadgeCurrent}`}>Active Plan</span>}
          <div className={styles.tierHeader}>
            <div className={styles.tierName}>Free Developer</div>
            <div className={styles.tierPriceContainer}>
              <span className={styles.tierPrice}>$0</span>
              <span className={styles.tierPeriod}>/ forever</span>
            </div>
            <p className={styles.tierDesc}>
              Perfect for prototypes, side projects, and developer experimentation.
            </p>
          </div>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span><strong>100 MB</strong> Account Cloud Storage</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Real-Time Transformations & Dynamic Formats</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>AI Background Removal & Content Moderation</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Full REST API, Scoped Keys, & Webhooks</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Multi-Tenant Workspaces & Team Invites</span>
            </li>
          </ul>
          <div className={styles.tierAction}>
            <div className={styles.currentBtn}>
              {!isPro ? `Currently Active (${currentUsageFormatted} used)` : 'Previous Plan (100 MB Limit)'}
            </div>
          </div>
        </div>

        {/* Pro Plan */}
        <div className={`${styles.tierCard} ${styles.tierCardFeatured} ${isPro ? styles.tierCardActive : ''}`}>
          <span className={`${styles.tierBadge} ${isPro ? styles.tierBadgeCurrent : ''}`}>
            {isPro ? 'Active Plan' : 'Coming Soon'}
          </span>
          <div className={styles.tierHeader}>
            <div className={styles.tierName}>Pro Creator</div>
            <div className={styles.tierPriceContainer}>
              <span className={styles.tierPrice}>$19</span>
              <span className={styles.tierPeriod}>/ month</span>
            </div>
            <p className={styles.tierDesc}>
              For fast-growing web apps, e-commerce stores, and high-volume media pipelines.
            </p>
          </div>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span><strong>50 GB</strong> High-Performance Cloud Storage</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Custom CDN Domains & SSL (e.g. cdn.yourbrand.com)</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Adaptive Bitrate Video Transcoding (HLS & DASH)</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Priority Worker Queues for Instant Processing</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Extended 90-Day Analytics & Delivery Metrics</span>
            </li>
          </ul>
          <div className={styles.tierAction}>
            {isPro ? (
              <div className={styles.currentBtn}>
                Currently Active ({currentUsageFormatted} used)
              </div>
            ) : (
              <Button
                variant="primary"
                icon={<ZapIcon size={16} />}
                onClick={handleJoinPro}
                disabled={joined}
                fullWidth
              >
                {joined ? 'Priority Granted' : 'Join Pro Waitlist'}
              </Button>
            )}
          </div>
        </div>

        {/* Enterprise Plan */}
        <div className={styles.tierCard}>
          <span className={styles.tierBadge}>Coming Soon</span>
          <div className={styles.tierHeader}>
            <div className={styles.tierName}>Enterprise</div>
            <div className={styles.tierPriceContainer}>
              <span className={styles.tierPrice}>Custom</span>
              <span className={styles.tierPeriod}>/ contract</span>
            </div>
            <p className={styles.tierDesc}>
              Dedicated infrastructure, compliance guarantees, and white-glove engineering support.
            </p>
          </div>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span><strong>Unlimited</strong> Scalable Multi-Cloud Storage</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>99.99% Uptime Service Level Agreement (SLA)</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Dedicated Storage Cluster & VPC Peering</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>Audit Logging, HIPAA / SOC2 Compliance</span>
            </li>
            <li className={styles.featureItem}>
              <CheckIcon size={16} className={styles.checkIcon} />
              <span>24/7 Dedicated Slack Channel & Support</span>
            </li>
          </ul>
          <div className={styles.tierAction}>
            <Button
              variant="secondary"
              onClick={handleContactEnterprise}
              fullWidth
            >
              Contact Team
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.footerNote}>
        Need more than 100 MB immediately for testing? Reach out to Anurag Mishra at{' '}
        <a href="mailto:sayalabs.studio@gmail.com" style={{ color: 'var(--ui-primary, #8b5cf6)', textDecoration: 'underline' }}>
          sayalabs.studio@gmail.com
        </a>{' '}
        for an instant test quota boost.
      </div>
    </Modal>
  );
}
