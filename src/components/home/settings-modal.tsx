import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import { useEffect, type RefObject } from 'react';
import { BackHandler, StyleSheet, Switch, Text, View } from 'react-native';

import { SoundPressable as Pressable } from '@/components/common/sound-pressable';
import { FONTS } from '@/constants/fonts';
import { useI18n } from '@/i18n';

type SettingsModalProps = {
  blurTarget: RefObject<View | null>;
  effectsEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  onClose: () => void;
  onEffectsChange: (enabled: boolean) => void;
  onMusicChange: (enabled: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  visible: boolean;
};

function SettingSwitch({ enabled }: { enabled: boolean }) {
  return (
    <View pointerEvents="none">
      <Switch
        ios_backgroundColor="#D3DDDE"
        thumbColor={enabled ? '#FFFFFF' : '#F4F4F4'}
        trackColor={{ false: '#D3DDDE', true: 'rgba(61,127,145,0.62)' }}
        value={enabled}
      />
    </View>
  );
}

function ToggleRow({
  enabled,
  icon,
  onChange,
  subtitle,
  title,
}: {
  enabled: boolean;
  icon: string;
  onChange: (enabled: boolean) => void;
  subtitle: string;
  title: string;
}) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityLabel={`${title}, ${enabled ? t('settings.open') : t('settings.closed')}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={() => onChange(!enabled)}
      style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
      <View style={styles.settingIcon}><Text style={styles.settingIconText}>{icon}</Text></View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <SettingSwitch enabled={enabled} />
    </Pressable>
  );
}

export function SettingsModal({
  blurTarget,
  effectsEnabled,
  musicEnabled,
  musicVolume,
  onClose,
  onEffectsChange,
  onMusicChange,
  onMusicVolumeChange,
  visible,
}: SettingsModalProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  if (!visible) return null;

  const volumePercent = Math.round(musicVolume * 100);

  return (
    <BlurView
      accessibilityViewIsModal
      blurMethod="dimezisBlurViewSdk31Plus"
      blurReductionFactor={2.2}
      blurTarget={blurTarget}
      intensity={72}
      style={styles.overlay}
      tint="dark">
      <View pointerEvents="none" style={styles.overlayTint} />
      <View style={styles.card}>
        <View style={styles.gearCircle}><Text style={styles.gearIcon}>⚙</Text></View>
        <Text style={styles.modalTitle}>{t('settings.title')}</Text>
        <Text style={styles.modalSubtitle}>{t('settings.subtitle')}</Text>

        <ToggleRow
          enabled={effectsEnabled}
          icon="🔊"
          onChange={onEffectsChange}
          subtitle={t('settings.soundSubtitle')}
          title={t('settings.sound')}
        />
        <ToggleRow
          enabled={musicEnabled}
          icon="♫"
          onChange={onMusicChange}
          subtitle={t('settings.musicSubtitle')}
          title={t('settings.music')}
        />

        <View style={[styles.volumeRow, !musicEnabled && styles.volumeDisabled]}>
          <View style={styles.volumeHeader}>
            <Text style={styles.volumeTitle}>{t('settings.volume')}</Text>
            <Text style={styles.volumeValue}>{volumePercent}%</Text>
          </View>
          <Slider
            accessibilityLabel={t('settings.volumeA11y', { value: volumePercent })}
            disabled={!musicEnabled}
            maximumTrackTintColor="#D3DEDF"
            maximumValue={1}
            minimumTrackTintColor="#3D7F91"
            minimumValue={0}
            onValueChange={onMusicVolumeChange}
            step={0.01}
            style={styles.slider}
            thumbTintColor="#3D7F91"
            value={musicVolume}
          />
        </View>

        <Pressable
          accessibilityLabel={t('settings.closeA11y')}
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
          <Text style={styles.doneText}>{t('settings.done')}</Text>
        </Pressable>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 150,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  overlayTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,22,31,0.48)' },
  card: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#D7E7E6',
    backgroundColor: '#F7FCFB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    elevation: 18,
  },
  gearCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#CDE5E7',
    backgroundColor: '#345D6B',
  },
  gearIcon: { color: '#FFFFFF', fontSize: 28, lineHeight: 31 },
  modalTitle: { marginTop: 10, color: '#233540', fontFamily: FONTS.extraBold, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalSubtitle: { marginTop: 5, color: '#60737A', fontFamily: FONTS.medium, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  settingRow: { width: '100%', height: 68, marginTop: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#D6E5E4', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  settingIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#E7F2F2' },
  settingIconText: { color: '#3D7F91', fontSize: 21 },
  settingCopy: { flex: 1, minWidth: 0, marginLeft: 11, paddingRight: 5 },
  settingTitle: { color: '#233540', fontFamily: FONTS.extraBold, fontSize: 14, fontWeight: '800' },
  settingSubtitle: { marginTop: 2, color: '#667A81', fontFamily: FONTS.medium, fontSize: 10.5 },
  volumeRow: { width: '100%', height: 73, marginTop: 9, paddingHorizontal: 14, paddingTop: 9, borderRadius: 18, borderWidth: 1, borderColor: '#D6E5E4', backgroundColor: '#FFFFFF' },
  volumeDisabled: { opacity: 0.48 },
  volumeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volumeTitle: { color: '#233540', fontFamily: FONTS.extraBold, fontSize: 12.5, fontWeight: '800' },
  volumeValue: { color: '#3D7F91', fontFamily: FONTS.extraBold, fontSize: 12, fontWeight: '800' },
  slider: { width: '100%', height: 38, marginTop: -1 },
  doneButton: { width: '100%', height: 50, marginTop: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#3D7F91', shadowColor: '#244B56', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 7, elevation: 4 },
  doneText: { color: '#FFFFFF', fontFamily: FONTS.extraBold, fontSize: 14, letterSpacing: 1, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
