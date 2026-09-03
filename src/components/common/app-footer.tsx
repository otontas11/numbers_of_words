import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/constants/fonts';
import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { useI18n } from '@/i18n';

type AppFooterProps = {
  activeItem?: 'home' | 'map' | 'collection' | 'tasks';
  onCollection: () => void;
  onHome: () => void;
  onMap: () => void;
  onTasks: () => void;
};

type FooterSymbol = ComponentProps<typeof SymbolView>['name'];

function FooterAction({
  active,
  accessibilityLabel,
  fallback,
  symbol,
  label,
  onPress,
}: {
  active: boolean;
  accessibilityLabel: string;
  fallback: string;
  symbol: FooterSymbol;
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
        colors={active ? ['#FFF9DC', '#F4D989'] : ['#FFFDF9', '#F6EEE3']}
        style={[styles.iconCircle, active && styles.iconCircleActive]}>
        <SymbolView
          fallback={<Text style={[styles.iconFallback, active && styles.iconActive]}>{fallback}</Text>}
          name={symbol}
          size={29}
          style={styles.symbol}
          tintColor={active ? '#173F72' : '#255A8C'}
          type="hierarchical"
        />
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
        fallback="⌂"
        label={t('footer.home')}
        onPress={onHome}
        symbol={{ ios: 'house.fill', android: 'home', web: 'home' }}
      />
      <FooterAction
        accessibilityLabel={t('footer.mapA11y')}
        active={activeItem === 'map'}
        fallback="✥"
        label={t('footer.map')}
        onPress={onMap}
        symbol={{ ios: 'map.fill', android: 'explore', web: 'explore' }}
      />
      <FooterAction
        accessibilityLabel={t('footer.collectionA11y')}
        active={activeItem === 'collection'}
        fallback="▣"
        label={t('footer.collection')}
        onPress={onCollection}
        symbol={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }}
      />
      <FooterAction
        accessibilityLabel={t('footer.tasksA11y')}
        active={activeItem === 'tasks'}
        fallback="▤"
        label={t('footer.tasks')}
        onPress={onTasks}
        symbol={{ ios: 'list.clipboard.fill', android: 'assignment', web: 'assignment' }}
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
    borderColor: '#E1B55B',
    shadowColor: '#7A684E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  iconCircleActive: { borderWidth: 2.3, borderColor: '#D99A27' },
  symbol: { width: 31, height: 31 },
  iconFallback: { color: '#255A8C', fontFamily: FONTS.extraBold, fontSize: 28, fontWeight: '800' },
  iconActive: { color: '#173F72' },
  label: { marginTop: 6, color: '#173F72', fontFamily: FONTS.extraBold, fontSize: 9, letterSpacing: 0.2, fontWeight: '800', textAlign: 'center' },
  labelActive: { color: '#A96E17' },
  activeMark: { width: 18, height: 2, marginTop: 5, borderRadius: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
});
