import React from 'react';

interface TrustLogoProps {
  className?: string;
  size?: number;
}

export const TrustLogo: React.FC<TrustLogoProps> = ({ className = '', size = 120 }) => {
  return (
    <svg
      id="svg-st-casimir-logo"
      width={size}
      height={size}
      viewBox="0 0 500 500"
      className={`select-none drop-shadow-lg ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer circular boundary */}
      <circle cx="250" cy="250" r="235" fill="white" stroke="#1e293b" strokeWidth="8" />
      <circle cx="250" cy="250" r="231" fill="none" stroke="#64748b" strokeWidth="1" />
      
      {/* Outer Glow / Shadow Ring */}
      <circle cx="250" cy="250" r="240" fill="none" stroke="black" strokeWidth="2" strokeOpacity="0.1" />

      {/* Stylized Green Crescent / Arch above figure */}
      <path
        d="M210 215 C230 195, 270 195, 290 215"
        stroke="#15803d"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Central Figure - Stretch human (St. Casimir / Charitable representation) */}
      {/* Head */}
      <circle cx="250" cy="225" r="14" fill="#881337" />
      {/* Left arm */}
      <path
        d="M250 240 C225 240, 210 220, 215 210"
        stroke="#881337"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right arm */}
      <path
        d="M250 240 C275 240, 290 220, 285 210"
        stroke="#881337"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Body / Torso */}
      <path
        d="M250 236 L250 290"
        stroke="#881337"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Split legs (charity/support lines) */}
      <path
        d="M250 290 C235 305, 230 330, 230 345"
        stroke="#881337"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M250 290 C265 305, 270 330, 270 345"
        stroke="#881337"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Center inner supporting leg */}
      <path
        d="M250 290 L250 345"
        stroke="#881337"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Styled Crimson Hands (Left Hand cupping) */}
      <path
        d="M170 230 
           C185 200, 220 230, 230 250 
           C240 270, 250 320, 250 345
           C225 345, 190 310, 180 295
           C160 265, 150 250, 170 230 Z"
        fill="#be123c"
        stroke="#881337"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Styled Crimson Hands (Left Outer Sleeve Hand element) */}
      <path
        d="M140 270 
           C160 250, 190 290, 210 320 
           C225 340, 240 350, 250 355
           C220 355, 185 330, 170 310
           C150 286, 135 275, 140 270 Z"
        fill="#9f1239"
        stroke="#701a75"
        strokeWidth="2"
      />

      {/* Styled Crimson Hands (Right Hand cupping) */}
      <path
        d="M330 230 
           C315 200, 280 230, 270 250 
           C260 270, 250 320, 250 345
           C275 345, 310 310, 320 295
           C340 265, 350 250, 330 230 Z"
        fill="#e11d48"
        stroke="#be123c"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Styled Crimson Hands (Right Outer Sleeve Hand element) */}
      <path
        d="M360 270 
           C340 250, 310 290, 290 320 
           C275 340, 260 350, 250 355
           C280 355, 315 330, 330 310
           C350 286, 365 275, 360 270 Z"
        fill="#f43f5e"
        stroke="#be123c"
        strokeWidth="2"
      />

      {/* Royal Crown on Top */}
      <g transform="translate(0, -50)">
        {/* Crown Cushion Base (Red Dome) */}
        <path
          d="M210 160 Q250 115 290 160"
          fill="#dc2626"
          stroke="#991b1b"
          strokeWidth="3"
        />
        {/* Crown Gold Frame Border */}
        <rect x="210" y="160" width="80" height="15" rx="5" fill="#f59e0b" stroke="#78350f" strokeWidth="3" />
        {/* Inner Gold Arch Curves of Crown */}
        <path
          d="M210 160 Q215 110 250 100 Q285 110 290 160"
          fill="none"
          stroke="#d97706"
          strokeWidth="6"
        />
        <path
          d="M230 160 Q235 120 250 100 Q265 120 270 160"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="4"
        />
        {/* Cross on top of the Crown */}
        <circle cx="250" cy="98" r="8" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="2" />
        <path
          d="M250 82 L250 64 M241 73 L259 73"
          stroke="#f59e0b"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Little pearl dots on crown arches */}
        <circle cx="250" cy="100" r="5" fill="white" stroke="#78350f" strokeWidth="1" />
        <circle cx="225" cy="120" r="4" fill="white" />
        <circle cx="275" cy="120" r="4" fill="white" />
        <circle cx="215" cy="142" r="4" fill="white" />
        <circle cx="285" cy="142" r="4" fill="white" />
        {/* Little gems on the base */}
        <circle cx="220" cy="167" r="3" fill="#ef4444" />
        <circle cx="235" cy="167" r="3" fill="#3b82f6" />
        <circle cx="250" cy="167" r="3" fill="#10b981" />
        <circle cx="265" cy="167" r="3" fill="#ef4444" />
        <circle cx="280" cy="167" r="3" fill="#3b82f6" />
      </g>

      {/* Decorative text border or curved banner text */}
      {/* Beautiful Malayalam Trust Name curve text fallback represent */}
      <path
        id="textPath-scc"
        d="M100 370 A210 210 0 0 0 400 370"
        fill="none"
        stroke="none"
      />
      <text fill="#0f172a" fontSize="19" fontWeight="900" letterSpacing="1">
        <textPath href="#textPath-scc" startOffset="50%" textAnchor="middle">
          സെന്റ് കസിമിർ ചാരിറ്റബിൾ ട്രസ്റ്റ് കടവൂർ
        </textPath>
      </text>
    </svg>
  );
};
