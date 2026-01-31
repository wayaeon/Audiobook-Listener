'use client';

import { useEffect, useRef, useState } from 'react';
import { getCoverBlobUrl } from '@/lib/api';

type Props = {
  bookId: string;
  accessToken: string | null;
  dataUrl: string | null | undefined;
  placeholder: string;
  className?: string;
};

export function CoverImage({ bookId, accessToken, dataUrl, placeholder, className }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (dataUrl !== null || !accessToken) return;
    let cancelled = false;
    getCoverBlobUrl(bookId, accessToken).then((url) => {
      if (!cancelled && url) {
        blobUrlRef.current = url;
        setBlobUrl(url);
      }
    });
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [bookId, accessToken, dataUrl]);

  if (dataUrl === undefined) {
    return <div className={`${className ?? ''} book-card-cover-skeleton`.trim()} aria-hidden />;
  }

  const src = dataUrl ?? blobUrl ?? placeholder;
  return <img src={src} alt="" className={className} />;
}
