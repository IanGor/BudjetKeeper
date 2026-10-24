import {
  Apple, Baby, Banknote, Beer, Bike, Book, Briefcase, Building2, Bus, Car, Cat, Coffee, Coins,
  CreditCard, Dog, Droplet, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HandCoins,
  HeartPulse, House, Landmark, Laptop, Music, PawPrint, PiggyBank, Pill, Pizza, Plane, Receipt,
  Scissors, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa, Sparkles, Tag, Train, TrendingUp,
  Utensils, Wallet, Wifi, Zap, type LucideIcon,
} from 'lucide-react'
import type { EntityKind } from './types'

export const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, 'credit-card': CreditCard, banknote: Banknote, coins: Coins, 'piggy-bank': PiggyBank,
  landmark: Landmark, briefcase: Briefcase, 'hand-coins': HandCoins, 'trending-up': TrendingUp,
  'building-2': Building2, laptop: Laptop, gift: Gift,
  'shopping-cart': ShoppingCart, 'shopping-bag': ShoppingBag, apple: Apple, utensils: Utensils,
  coffee: Coffee, pizza: Pizza, beer: Beer, bus: Bus, train: Train, car: Car, fuel: Fuel, bike: Bike,
  plane: Plane, house: House, sofa: Sofa, zap: Zap, droplet: Droplet, wifi: Wifi,
  smartphone: Smartphone, 'heart-pulse': HeartPulse, pill: Pill, dumbbell: Dumbbell,
  scissors: Scissors, shirt: Shirt, 'gamepad-2': Gamepad2, film: Film, music: Music, book: Book,
  'graduation-cap': GraduationCap, baby: Baby, cat: Cat, dog: Dog, 'paw-print': PawPrint,
  sparkles: Sparkles, receipt: Receipt, tag: Tag,
}

export const ICON_CHOICES: Record<EntityKind, string[]> = {
  income: ['briefcase', 'hand-coins', 'trending-up', 'building-2', 'laptop', 'gift', 'coins', 'piggy-bank', 'landmark', 'banknote'],
  account: ['wallet', 'credit-card', 'banknote', 'coins', 'piggy-bank', 'landmark', 'smartphone', 'briefcase'],
  expense: Object.keys(ICONS),
}

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Tag
}

export const COLORS = ['#e0b44c', '#d9a441', '#6fbf73', '#4fa3d1', '#9b7fd4', '#e07a5f', '#e85d75', '#5fc1b5', '#b0a596']

export const DEFAULT_COLOR: Record<EntityKind, string> = {
  income: '#6fbf73',
  account: '#d9a441',
  expense: '#e0b44c',
}
