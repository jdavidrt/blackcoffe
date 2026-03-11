import { useId } from "react";

function CoffeePouringAnimation() {
  const uid = useId();
  const clipId = `cupClip-${uid}`;

  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className="mb-4"
    >
      <g>
        {/* Plate/Saucer */}
        <ellipse
          cx="60"
          cy="90"
          rx="35"
          ry="8"
          fill="#8B4513"
        />
        <ellipse
          cx="60"
          cy="88"
          rx="35"
          ry="8"
          fill="#A0522D"
        />

        {/* Cup Body - Rounded */}
        <defs>
          <clipPath id={clipId}>
            <path d="M 38 45 Q 37 50 38 55 L 38 70 Q 38 78 45 82 Q 52 85 60 85 Q 68 85 75 82 Q 82 78 82 70 L 82 55 Q 83 50 82 45 Z" />
          </clipPath>
        </defs>

        {/* Cup outline with rounded shape */}
        <path
          d="M 38 45 Q 37 50 38 55 L 38 70 Q 38 78 45 82 Q 52 85 60 85 Q 68 85 75 82 Q 82 78 82 70 L 82 55 Q 83 50 82 45 Z"
          fill="#FFFFFF"
          stroke="#8B4513"
          strokeWidth="2.5"
        />

        {/* Cup rim (top ellipse) */}
        <ellipse
          cx="60"
          cy="45"
          rx="22"
          ry="6"
          fill="#FFFFFF"
          stroke="#8B4513"
          strokeWidth="2.5"
        />

        {/* Coffee filling up - Animated */}
        <rect
          x="35"
          y="45"
          width="50"
          height="40"
          fill="#6B3410"
          clipPath={`url(#${clipId})`}
        >
          <animate
            attributeName="y"
            values="85;65;45;65;85"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="height"
            values="0;20;40;20;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>

        {/* Coffee surface (top ellipse) - Animated */}
        <ellipse
          cx="60"
          cy="45"
          rx="21"
          ry="5"
          fill="#4A2511"
        >
          <animate
            attributeName="cy"
            values="85;65;45;65;85"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </ellipse>

        {/* Cup Handle - Rounded */}
        <path
          d="M 82 52 C 104 44 100 72 82 68"
          fill="none"
          stroke="#8B4513"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Steam - Animated - Grows as cup fills */}
        <g>
          <path d="M 50 40 Q 48 30 50 20" stroke="#666" strokeWidth="1" fill="none" strokeLinecap="round">
            <animate attributeName="opacity" values="0;0.3;0.7;0.3;0" dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-width" values="0.5;1.5;3;1.5;0.5" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M 60 38 Q 58 28 60 18" stroke="#666" strokeWidth="1" fill="none" strokeLinecap="round">
            <animate attributeName="opacity" values="0;0.2;0.6;0.2;0" dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-width" values="0.5;1.5;3.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M 70 40 Q 72 30 70 20" stroke="#666" strokeWidth="1" fill="none" strokeLinecap="round">
            <animate attributeName="opacity" values="0;0.25;0.65;0.25;0" dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-width" values="0.5;1.5;3;1.5;0.5" dur="2s" repeatCount="indefinite" />
          </path>
        </g>
      </g>
    </svg>
  );
}

export default CoffeePouringAnimation;
