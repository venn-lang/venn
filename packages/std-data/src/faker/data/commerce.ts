export const PRODUCTS: readonly string[] = [
  "Chair",
  "Keyboard",
  "Lamp",
  "Backpack",
  "Mug",
  "Notebook",
  "Headphones",
  "Monitor",
  "Desk",
  "Bottle",
  "Jacket",
  "Sneakers",
  "Table",
  "Shelf",
  "Camera",
];

export const MATERIALS: readonly string[] = [
  "cotton",
  "steel",
  "oak",
  "leather",
  "glass",
  "aluminium",
  "ceramic",
  "linen",
];

export const CATEGORIES: readonly string[] = [
  "Electronics",
  "Home",
  "Outdoors",
  "Books",
  "Clothing",
  "Toys",
  "Grocery",
  "Sports",
  "Beauty",
  "Automotive",
];

export const COLORS: readonly [string, string][] = [
  ["black", "#000000"],
  ["white", "#ffffff"],
  ["red", "#e53935"],
  ["blue", "#1e88e5"],
  ["green", "#43a047"],
  ["amber", "#ffb300"],
  ["violet", "#8e24aa"],
  ["teal", "#00897b"],
  ["slate", "#546e7a"],
  ["coral", "#ff7043"],
];

/** `[code, symbol, name]`. */
export const CURRENCIES: readonly [string, string, string][] = [
  ["BRL", "R$", "Brazilian Real"],
  ["USD", "$", "US Dollar"],
  ["EUR", "€", "Euro"],
  ["GBP", "£", "Pound Sterling"],
  ["JPY", "¥", "Japanese Yen"],
  ["CAD", "$", "Canadian Dollar"],
];

/** `[brand, prefix, length]`. The prefixes are the real issuer ranges. */
export const CARD_BRANDS: readonly [string, string, number][] = [
  ["Visa", "4", 16],
  ["Mastercard", "51", 16],
  ["Mastercard", "55", 16],
  ["Discover", "6011", 16],
  ["Elo", "4011", 16],
];
