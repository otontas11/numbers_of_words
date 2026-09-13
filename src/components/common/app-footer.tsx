import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/constants/fonts';
import {
  FooterCollectionIcon,
  FooterHomeIcon,
  FooterMapIcon,
  FooterTasksIcon,
} from '@/components/common/game-icons';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { useI18n } from '@/i18n';

type AppFooterProps = {
  activeItem?: 'home' | 'map' | 'collection' | 'tasks';
  onCollection: () => void;
  onHome: () => void;
  onMap: () => void;
  onTasks: () => void;
};

type FooterGlyph = ComponentType<{ color?: string; filled?: boolean; size?: number }>;

function FooterAction({
  active,
  accessibilityLabel,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean;
  accessibilityLabel: string;
  icon: FooterGlyph;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <LinearGradient
        colors={active ? ['#FFF9D7', '#E8C45A'] : ['#FFFDF9', '#F6EEE3']}
        style={[styles.iconCircle, active && styles.iconCircleActive]}>
        <Icon color={active ? '#173F72' : '#255A8C'} filled={active} size={29} />
      </LinearGradient>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {active ? <LinearGradient colors={['#D7951F', '#F2C353']} style={styles.activeMark} /> : null}
    </Pressable>
  );
}

export function AppFooter({
  activeItem,
  onCollection,
  onHome,
  onMap,
  onTasks,
}: AppFooterProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <LinearGradient
      colors={['rgba(255,252,246,0)', 'rgba(255,250,242,0.91)', '#FFF9F0']}
      locations={[0, 0.25, 1]}
      pointerEvents="box-none"
      style={[styles.footer, { height: 104 + insets.bottom, paddingBottom: Math.max(insets.bottom, 5) }]}>
      <FooterAction
        accessibilityLabel={t('footer.homeA11y')}
        active={activeItem === 'home'}
        icon={FooterHomeIcon}
        label={t('footer.home')}
        onPress={onHome}
      />
      <FooterAction
        accessibilityLabel={t('footer.mapA11y')}
        active={activeItem === 'map'}
        icon={FooterMapIcon}
        label={t('footer.map')}
        onPress={onMap}
      />
      <FooterAction
        accessibilityLabel={t('footer.collectionA11y')}
        active={activeItem === 'collection'}
        icon={FooterCollectionIcon}
        label={t('footer.collection')}
        onPress={onCollection}
      />
      <FooterAction
        accessibilityLabel={t('footer.tasksA11y')}
        active={activeItem === 'tasks'}
        icon={FooterTasksIcon}
        label={t('footer.tasks')}
        onPress={onTasks}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    paddingTop: 13,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  action: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    borderWidth: 1.8,
    borderColor: '#E2B65C',
    shadowColor: '#7A684E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  iconCircleActive: { borderWidth: 2.3, borderColor: '#D69B2B' },
  label: { marginTop: 6, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 9, letterSpacing: 0.2, fontWeight: '800', textAlign: 'center' },
  labelActive: { color: '#A96E17' },
  activeMark: { width: 18, height: 2, marginTop: 5, borderRadius: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
});
