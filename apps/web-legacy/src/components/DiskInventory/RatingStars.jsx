import React, { useState } from "react";
import PropTypes from "prop-types";

export default function RatingStars({
  rating,
  editable = false,
  onChange,
  isSaving = false,
  className = "",
}) {
  const [hoverValue, setHoverValue] = useState(null);

  if (rating == null || Number.isNaN(Number(rating))) return null;

  const clamped = Math.max(0, Math.min(5, Number(rating)));
  const displayValue = hoverValue == null ? clamped : hoverValue;
  const percent = (displayValue / 5) * 100;
  const stars = "\u2605\u2605\u2605\u2605\u2605";
  const halfSteps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  const nudgeRating = (delta) => {
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
        <div className="stars-fill" style={{ width: `${percent}%` }}>
          {stars}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stars stars-interactive ${isSaving ? "is-saving" : ""} ${className}`.trim()}
      aria-label={`rating ${clamped} out of 5`}
      title={isSaving ? "Saving rating..." : `rating ${clamped} out of 5`}
      onMouseLeave={() => setHoverValue(null)}
    >
      <div className="stars-base">{stars}</div>
      <div className="stars-fill" style={{ width: `${percent}%` }}>
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
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                nudgeRating(0.5);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                nudgeRating(-0.5);
              } else if (e.key === "Home") {
                e.preventDefault();
                onChange?.(0);
                setHoverValue(0);
              } else if (e.key === "End") {
                e.preventDefault();
                onChange?.(5);
                setHoverValue(5);
              }
            }}
            aria-label={`Set rating to ${value} out of 5`}
            title={`${value} star${value === 1 ? "" : "s"}`}
          />
        ))}
      </div>
    </div>
  );
}

RatingStars.propTypes = {
  rating: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  isSaving: PropTypes.bool,
  className: PropTypes.string,
};
