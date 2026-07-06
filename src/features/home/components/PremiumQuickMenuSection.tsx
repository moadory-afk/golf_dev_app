import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { Icon, type IconName } from '../../../components/Icon'
import { colorLayers, createShadow, radius, spacing, typography } from '../../../design/tokens'
import { useSkin } from '../../../skins'

export type PremiumQuickMenuItem = {
  key: string
  icon: IconName
  title: string
  subtitle: string
  badge?: string
  featured?: boolean
  onPress: () => void
}

export function PremiumQuickMenuSection({ items }: { items: PremiumQuickMenuItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <PremiumQuickMenuCard key={item.key} item={item} />
      ))}
    </View>
  )
}

function PremiumQuickMenuCard({ item }: { item: PremiumQuickMenuItem }) {
  const { palette } = useSkin()
  const iconColor = item.featured ? palette.accentText : palette.green
  const iconBg = item.featured ? palette.green : palette.greenLight

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={item.onPress}
      style={[
        styles.card,
        createShadow(palette, item.featured ? 2 : 1),
        {
          backgroundColor: palette.card,
          borderColor: colorLayers.cardHairline,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon name={item.icon} size={25} color={iconColor} strokeWidth={2.1} />
      </View>

      {!!item.badge && (
        <View style={[styles.badge, { backgroundColor: palette.greenLight, borderColor: palette.border }]}> 
          <Text style={[styles.badgeText, { color: palette.green }]}>{item.badge}</Text>
        </View>
      )}

      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
      <Text style={[styles.subtitle, { color: palette.muted }]} numberOfLines={1}>{item.subtitle}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '31.1%',
    minHeight: 118,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 45,
    height: 45,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '900',
  },
  title: {
    ...typography.bodyLg,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
  },
})
