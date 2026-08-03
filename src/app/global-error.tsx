'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <EmptyState
            icon="💥"
            title="Something went wrong"
            description="A critical error occurred. Try reloading the page."
            action={
              <Button variant="secondary" onClick={reset}>
                Try Again
              </Button>
            }
          />
        </div>
      </body>
    </html>
  );
}
