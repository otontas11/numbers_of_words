import Svg, { Path } from 'react-native-svg';

type GameIconProps = {
  color?: string;
  size?: number;
};

type GemIconProps = GameIconProps & {
  facetColor?: string;
  outlineColor?: string;
};

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
