import { useState } from 'react';

type RatingStarsProps = {
  rating: number;
  editable?: boolean;
  isSaving?: boolean;
  className?: string;
  onChange?: (rating: number) => void;
};

export function RatingStars({
  rating,
  editable = false,
  isSaving = false,
  className = '',
  onChange,
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
  const displayValue = hoverValue == null ? clamped : hoverValue;
  const percent = `${(displayValue / 5) * 100}%`;
  const stars = '★★★★★';
  const halfSteps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  const nudgeRating = (delta: number) => {
    const next = Math.max(0, Math.min(5, Math.round((clamped + delta) * 2) / 2));
    onChange?.(next);
    setHoverValue(next);
  };

  if (!editable) {
    return (
      <div
        className={`stars ${className}`.trim()}
        aria-label={`rating ${clamped} out of 5`}
        title={`rating ${clamped} out of 5`}
      >
        <div className="stars-base">{stars}</div>
        <div className="stars-fill" style={{ width: percent }}>
          {stars}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stars stars-interactive ${isSaving ? 'is-saving' : ''} ${className}`.trim()}
      onMouseLeave={() => setHoverValue(null)}
      aria-label={`rating ${clamped} out of 5`}
      title={isSaving ? 'Saving rating...' : `rating ${clamped} out of 5`}
    >
      <div className="stars-base">{stars}</div>
      <div className="stars-fill" style={{ width: percent }}>
        {stars}
      </div>
      <div className="stars-hitbox">
        {halfSteps.map((value) => (
          <button
            key={value}
            type="button"
            className="star-hit"
            disabled={isSaving}
            onMouseEnter={() => setHoverValue(value)}
            onFocus={() => setHoverValue(value)}
            onBlur={() => setHoverValue(null)}
            onClick={() => onChange?.(value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault();
                nudgeRating(0.5);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault();
                nudgeRating(-0.5);
              } else if (event.key === 'Home') {
                event.preventDefault();
                onChange?.(0);
                setHoverValue(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                onChange?.(5);
                setHoverValue(5);
              }
            }}
            aria-label={`Set rating to ${value} out of 5`}
            title={`${value} star${value === 1 ? '' : 's'}`}
          />
        ))}
      </div>
    </div>
  );
}
