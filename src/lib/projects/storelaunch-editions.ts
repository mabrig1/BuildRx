/** Shared, browser-safe StoreLaunch edition metadata. No server imports. */
export const STORELAUNCH_EDITIONS = [
  { id: "restaurant", name: "Restaurant & Food", folder: "01_Restaurant", icon: "🍲" },
  { id: "supermarket", name: "Supermarket & Groceries", folder: "02_Supermarket", icon: "🛒" },
  { id: "gadgets", name: "Gadgets & Electronics", folder: "03_Gadgets", icon: "📱" },
  { id: "services", name: "Services & Bookings", folder: "04_Services", icon: "✨" },
] as const;
export type StoreLaunchEdition = typeof STORELAUNCH_EDITIONS[number]["id"];