import type { SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number;
};

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15.5V4m0 0L8 8m4-4 4 4" />
      <path d="M3.5 15v2.5A2.5 2.5 0 0 0 6 20h12a2.5 2.5 0 0 0 2.5-2.5V15" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.75" cy="9.75" r="1.75" />
      <path d="m3.5 17 4.6-4.3a2 2 0 0 1 2.7 0l3.2 3 1.6-1.5a2 2 0 0 1 2.7 0l2.2 2" />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M2.5 14.5h19M7.5 5v4.5M16.5 5v4.5M10 14.5h4" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19.4 14.6a1.5 1.5 0 0 0 .3 1.65l.05.05a1.82 1.82 0 1 1-2.57 2.57l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.11a1.82 1.82 0 1 1-3.64 0v-.06a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05a1.82 1.82 0 1 1-2.57-2.57l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9h-.11a1.82 1.82 0 1 1 0-3.64h.06a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.05A1.82 1.82 0 1 1 8.1 4.98l.05.05a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37v-.11a1.82 1.82 0 1 1 3.64 0v.06a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.82 1.82 0 1 1 2.57 2.57l-.05.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.11a1.82 1.82 0 1 1 0 3.64h-.06a1.5 1.5 0 0 0-1.37.9Z" />
      <circle cx="12" cy="12" r="3.1" />
    </Icon>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.6 8 18 9.5 13.6 11 12 15.5 10.4 11 6 9.5 10.4 8 12 3.5Z" />
      <path d="M18.5 15.5 19.25 17.5 21.25 18.25 19.25 19 18.5 21 17.75 19 15.75 18.25 17.75 17.5 18.5 15.5Z" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.29 3.86 2.5 17.5A2 2 0 0 0 4.21 20.5h15.58a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9.5v4.25M12 17.25h.01" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V4M4 20h16" />
      <path d="M8.5 20v-5.5M13 20V8.5M17.5 20v-8" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </Icon>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7.5A2 2 0 0 1 5 5.5h3.6a2 2 0 0 1 1.5.7l1 1.2H19a2 2 0 0 1 2 2v7.1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h16M9.5 6.5V4.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6.5" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4A1.5 1.5 0 0 0 16.7 19l.8-12.5" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.5" />
      <path d="M15 6.5V6A2.5 2.5 0 0 0 12.5 3.5H6A2.5 2.5 0 0 0 3.5 6v6.5A2.5 2.5 0 0 0 6 15h.5" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 18.5a4 4 0 0 1-.4-7.98 5.5 5.5 0 0 1 10.64-1.36A4.25 4.25 0 0 1 17.5 18.5Z" />
    </Icon>
  );
}

export function ZapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 2.5 4.5 13.5H11l-.5 8 9-11H13l.5-8Z" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7a2 2 0 0 0 1.7-.95l.6-1A1.5 1.5 0 0 1 10.8 3.3h2.4a1.5 1.5 0 0 1 1.3.75l.6 1A2 2 0 0 0 16.8 6h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </Icon>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
      <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7 7.3 5.2a2 2 0 0 0 2.4 0L20.5 7" />
    </Icon>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7.5" cy="12" r="3.5" />
      <path d="M11 12h9.5M18 12v3.5M15.5 12v2.5" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="10" width="16" height="10.5" rx="2.5" />
      <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" />
    </Icon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.4 9.5h17.2M3.4 14.5h17.2" />
      <path d="M12 3.25c2.2 2.4 3.3 5.4 3.3 8.75S14.2 18.35 12 20.75c-2.2-2.4-3.3-5.4-3.3-8.75S9.8 5.65 12 3.25Z" />
    </Icon>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" />
      <path d="M9 11h6M9 15h4" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20.5h4L19 9.5a2.12 2.12 0 0 0-3-3L5 17.5Z" />
      <path d="m14.5 7.5 3 3" />
    </Icon>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.25 20.5 7.5v9L12 20.75 3.5 16.5v-9Z" />
      <path d="M3.7 7.35 12 11.5l8.3-4.15M12 11.5v9.25" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" />
      <path d="M13.75 19.5a2 2 0 0 1-3.5 0" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 19.5 5.75v5.5c0 4.5-3 7.75-7.5 9.75-4.5-2-7.5-5.25-7.5-9.75v-5.5Z" />
      <path d="m9.25 12 2 2 3.5-3.75" />
    </Icon>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.75c3 1.75 4.75 5 4.75 8.5L14 16H10l-2.75-4.75c0-3.5 1.75-6.75 4.75-8.5Z" />
      <circle cx="12" cy="10" r="1.75" />
      <path d="M10 16c-1.5 1.25-2 2.75-2 4.25 1.5 0 3-.5 4.25-2M14 16c1.5 1.25 2 2.75 2 4.25-1.5 0-3-.5-4.25-2" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.5 2.6 5.4 5.9.85-4.25 4.1 1 5.9L12 17l-5.25 2.75 1-5.9L3.5 9.75l5.9-.85Z" />
    </Icon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.6 3.4H4.9A1.9 1.9 0 0 0 3 5.3v6.7a2 2 0 0 0 .6 1.4l7.6 7.6a2 2 0 0 0 2.8 0l6.6-6.6a2 2 0 0 0 0-2.8l-7.6-7.6a2 2 0 0 0-1.4-.6Z" />
      <circle cx="7.75" cy="7.75" r="1.25" />
    </Icon>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.9 6.6a4.5 4.5 0 0 0 5.9 5.85l-8.2 8.2a2.6 2.6 0 0 1-3.7-3.7l8.2-8.2a4.5 4.5 0 0 0-2.2-2.15Z" />
    </Icon>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 16.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1.5h9v1.5a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-2" />
      <path d="M3.5 16.5v-4l2-5.25A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.9 1.25l2 5.25v4Z" />
      <path d="M3.5 12.5h17M6.5 14.5h2M15.5 14.5h2" />
    </Icon>
  );
}

export function MoneyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M4 7.5 6.5 4.25h11L20 7.5" />
      <circle cx="12" cy="13" r="2.75" />
    </Icon>
  );
}

export function GemIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.5h11l3.5 5-9 12-9-12Z" />
      <path d="M3 8.5h18M9 8.5 12 20.5M15 8.5 12 20.5M6.5 3.5 9 8.5M17.5 3.5 15 8.5" />
    </Icon>
  );
}

export function FireIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21.5c3.31 0 6-2.4 6-5.4 0-4.2-4.5-6.35-4.5-10.1-2 1-2.9 2.6-2.9 4.1 0 1.5-1 2-1.7 1.3-.55-.55-.9-1.4-.9-2.3-1.3 1.3-2 3-2 4.7 0 3 2.69 7.7 6 7.7Z" />
    </Icon>
  );
}

export function BulbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 18h5M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.7l.1.5h5l.1-.5c.1-.6.4-1.2 1-1.7A6 6 0 0 0 12 3Z" />
    </Icon>
  );
}

export function BotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="3" />
      <path d="M12 3v4.5M8.5 13h.01M15.5 13h.01M12 3a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 3Z" />
      <path d="M9.5 16.5h5" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
      <path d="M3.5 16v2.5A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5V16" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12H5m0 0 5.5-5.5M5 12l5.5 5.5" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 7.8A17.2 17.2 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.5-.65" />
      <path d="M10 10.1a3 3 0 0 0 4 4.1M3.5 3.5l17 17" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function LinkGlyphIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.5 13.5a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 0 0-5.66-5.66l-1.2 1.2" />
      <path d="M13.5 10.5a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66l1.2-1.2" />
    </Icon>
  );
}
