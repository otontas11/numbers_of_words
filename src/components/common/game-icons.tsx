import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

type GameIconProps = {
  color?: string;
  size?: number;
};

type FootprintIconProps = GameIconProps & {
  filled?: boolean;
};

type GemIconProps = GameIconProps & {
  facetColor?: string;
  outlineColor?: string;
};

type FooterGlyphProps = GameIconProps & {
  filled?: boolean;
};

const FOOTER_STROKE = 2;

export function BackIcon({ color = '#F2FAFC', size = 27 }: GameIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M19 12H5m6-6-6 6 6 6"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.35}
      />
    </Svg>
  );
}

export function SettingsIcon({ color = '#EDF8FA', size = 26 }: GameIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.5 7.5 0 0 0-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65c-.61.25-1.18.58-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.08.66-.08.98s.04.66.08.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.51.4 1.08.73 1.69.98l.38 2.65c.04.24.24.42.49.42h4c.25 0 .45-.18.49-.42l.38-2.65a7.5 7.5 0 0 0 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
        fill={color}
        fillRule="evenodd"
      />
    </Svg>
  );
}

export function HintIcon({ color = '#FFF5B8', size = 25 }: GameIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M12 3.35a6.2 6.2 0 0 0-3.72 11.16c.58.43.92 1.08.92 1.78v1.46h5.6v-1.46c0-.7.34-1.35.92-1.78A6.2 6.2 0 0 0 12 3.35Z"
        fill={color}
      />
      <Path
        d="M12 .9v1.25M4.75 3.9l1.2 1.2M19.25 3.9l-1.2 1.2M2.8 10.7h1.7M19.5 10.7h1.7"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.7}
      />
      <Path
        d="M9.25 7.05c-.85.65-1.38 1.68-1.38 2.82"
        fill="none"
        stroke="rgba(255,255,255,0.72)"
        strokeLinecap="round"
        strokeWidth={1.2}
      />
    </Svg>
  );
}

export function FootprintIcon({
  color = '#B98834',
  filled = false,
  size = 18,
}: FootprintIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        // Material Design'in gerçek insan ayak izi silueti: parmaklar,
        // taban ve topuk tek bir doğal footprint olarak okunur.
        d="M16 2A2 2 0 1 1 14 4A2 2 0 0 1 16 2M12.04 3A1.5 1.5 0 1 1 10.54 4.5A1.5 1.5 0 0 1 12.04 3M9.09 4.5A1 1 0 1 1 8.09 5.5A1 1 0 0 1 9.09 4.5M7.04 6A1 1 0 1 1 6.04 7A1 1 0 0 1 7.04 6M14.53 12A2.5 2.5 0 0 0 17 9.24A2.6 2.6 0 0 0 14.39 7H11.91A6 6 0 0 0 6.12 11.4A2 2 0 0 0 6.23 12.8A6.8 6.8 0 0 1 6.91 15.76A6.89 6.89 0 0 1 6.22 18.55A1.92 1.92 0 0 0 6.3 20.31A3.62 3.62 0 0 0 10.19 21.91A3.5 3.5 0 0 0 12.36 16.63A2.82 2.82 0 0 1 11.91 15S11.68 12 14.53 12Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={filled ? 0 : 1.15}
      />
    </Svg>
  );
}

export function GemIcon({
  color = '#C9F6FF',
  facetColor = 'rgba(70,145,171,0.72)',
  outlineColor = 'rgba(255,255,255,0.92)',
  size = 12,
}: GemIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M5.1 4.2h13.8L22 9.25 12 20.8 2 9.25 5.1 4.2Z"
        fill={color}
        stroke={outlineColor}
        strokeLinejoin="round"
        strokeWidth={1.65}
      />
      <Path
        d="m5.1 4.2 2.2 5.05L12 20.8l4.7-11.55 2.2-5.05M2 9.25h20M7.3 9.25 12 4.2l4.7 5.05"
        fill="none"
        stroke={facetColor}
        strokeLinejoin="round"
        strokeWidth={1.2}
      />
    </Svg>
  );
}

export function ShuffleIcon({ color = '#F2FAFC', size = 29 }: GameIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="m18 4 3 3-3 3M18 14l3 3-3 3M3 7h3.2c1.85 0 3.3 1.08 4.13 2.74l2.3 4.59C13.47 16 14.93 17 16.8 17H21M3 17h3.2c1.85 0 3.3-1.08 4.13-2.74l2.3-4.59C13.47 8 14.93 7 16.8 7H21"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.15}
      />
    </Svg>
  );
}

export function FooterHomeIcon({ color = '#255A8C', filled = false, size = 29 }: FooterGlyphProps) {
  const ink = filled ? '#FFF4C8' : color;
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Circle cx="12" cy="12" fill="none" r="9" stroke={color} strokeWidth={FOOTER_STROKE} />
      <Path
        d="M12 3.55 13.85 10.15 20.45 12 13.85 13.85 12 20.45 10.15 13.85 3.55 12 10.15 10.15Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={FOOTER_STROKE}
      />
      <Circle cx="12" cy="12" fill={ink} r="1.45" />
    </Svg>
  );
}

export function FooterMapIcon({ color = '#255A8C', filled = false, size = 29 }: FooterGlyphProps) {
  const ink = filled ? '#FFF4C8' : color;
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Circle cx="12" cy="12" fill={filled ? color : 'none'} r="8.45" stroke={color} strokeWidth={FOOTER_STROKE} />
      <Ellipse
        cx="12"
        cy="12"
        fill="none"
        rx="3.45"
        ry="8.45"
        stroke={ink}
        strokeWidth={FOOTER_STROKE}
      />
      <Ellipse
        cx="12"
        cy="12"
        fill="none"
        rx="8.45"
        ry="3.2"
        stroke={ink}
        strokeWidth={FOOTER_STROKE}
      />
    </Svg>
  );
}

export function FooterCollectionIcon({ color = '#255A8C', filled = false, size = 29 }: FooterGlyphProps) {
  const ink = filled ? '#FFF4C8' : color;
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Rect
        fill={filled ? color : 'none'}
        height="16.2"
        rx="2.1"
        stroke={color}
        strokeWidth={FOOTER_STROKE}
        width="13.6"
        x="5.2"
        y="3.9"
      />
      <Path d="M8.85 4.7v14.6" fill="none" stroke={ink} strokeLinecap="round" strokeWidth={FOOTER_STROKE} />
      <Circle cx="14.15" cy="10.15" fill="none" r="2.55" stroke={ink} strokeWidth={FOOTER_STROKE} />
      <Path d="M14.15 8.35 15.35 10.15 14.15 11.95 12.95 10.15Z" fill={ink} />
    </Svg>
  );
}

export function FooterTasksIcon({ color = '#255A8C', filled = false, size = 29 }: FooterGlyphProps) {
  const ink = filled ? '#FFF4C8' : color;
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Circle cx="12" cy="9.7" fill={filled ? color : 'none'} r="6.05" stroke={color} strokeWidth={FOOTER_STROKE} />
      <Path
        d="M8.4 15.15 7.15 21.05 12 18.55 16.85 21.05 15.6 15.15"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={FOOTER_STROKE}
      />
      <Path
        d="M12 6.35 12.9 9.15 15.8 9.7 12.9 10.45 12 13.2 11.1 10.45 8.2 9.7 11.1 9.15Z"
        fill={ink}
      />
    </Svg>
  );
}
