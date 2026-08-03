'use client';

import { useEffect } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({
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
    <EmptyState
      icon="💥"
      title="Something went wrong"
      description="An unexpected error occurred. Try reloading the page, or head back to the dashboard."
      action={
        <>
          <Button variant="secondary" onClick={reset}>
            Try Again
          </Button>
        </>
      }
    />
  );
}
