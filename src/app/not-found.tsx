import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { SearchIcon } from '@/components/ui/icons';

export default function NotFound() {
  return (
    <EmptyState
      icon={<SearchIcon size={26} />}
      headingLevel={1}
      title="Page Not Found"
      description="The page you're looking for doesn't exist or may have been moved."
      action={
        <Link href="/">
          <Button variant="primary">Back to Dashboard</Button>
        </Link>
      }
    />
  );
}
