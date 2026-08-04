import React from 'react';
import { Star, StarHalf } from 'lucide-react';

/** Monochrome star rating out of 5, halves supported (e.g. 3.5). */
export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;

  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        if (i < full) {
          return <Star key={i} size={13} strokeWidth={1.5} className="fill-text-primary text-text-primary" />;
        }
        if (i === full && hasHalf) {
          return <StarHalf key={i} size={13} strokeWidth={1.5} className="fill-text-primary text-text-primary" />;
        }
        return <Star key={i} size={13} strokeWidth={1.5} className="text-text-muted" />;
      })}
    </div>
  );
}
