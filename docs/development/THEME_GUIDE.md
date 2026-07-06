# GogoPar Theme Guide

## 1. Theme Token

디자인 값은 하드코딩하지 않고 Theme Token으로 관리한다.

```ts
theme.colors.primary
theme.spacing.lg
theme.radius.card
theme.shadows.card
theme.typography.heroTitle
```

---

## 2. Colors

```ts
primary: '#1E7A44'
secondary: '#4CAF50'
accent: '#FFD54F'
background: '#F7FAF7'
card: '#FFFFFF'
textPrimary: '#111827'
textSecondary: '#6B7280'
danger: '#E74C3C'
```

---

## 3. Spacing

```ts
xs: 4
sm: 8
md: 12
lg: 16
xl: 24
xxl: 32
```

---

## 4. Radius

```ts
sm: 8
md: 14
lg: 20
card: 24
hero: 28
pill: 999
```

---

## 5. Shadow

```ts
card:
  y: 8
  blur: 24
  opacity: 0.10

hero:
  y: 12
  blur: 32
  opacity: 0.16
```

---

## 6. Motion

```ts
buttonPress: 120ms
fade: 250ms
slide: 350ms
heroTransition: 500ms
```
