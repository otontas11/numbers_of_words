import Svg, { Circle, Path } from 'react-native-svg';

type GameIconProps = {
  color?: string;
  size?: number;
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

export function HintIcon({ color = '#FFF3B5', size = 25 }: GameIconProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M12 2.25a6.55 6.55 0 0 0-3.93 11.79c.59.44.93 1.1.93 1.8V18h6v-2.16c0-.7.34-1.36.93-1.8A6.55 6.55 0 0 0 12 2.25Z"
        fill={color}
      />
      <Path
        d="M9.25 20h5.5M10.5 22h3"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
      <Circle cx={9.6} cy={6.8} fill="rgba(255,255,255,0.7)" r={1.05} />
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
