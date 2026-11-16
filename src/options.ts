import type { Budget, Diet, Meal } from "../shared/types";

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

export const CUISINES: Option<string>[] = [
  { value: "North Indian", label: "North Indian" },
  { value: "South Indian", label: "South Indian" },
  { value: "Biryani", label: "Biryani" },
  { value: "Chinese", label: "Chinese" },
  { value: "Thali", label: "Thali" },
  { value: "Pizza", label: "Pizza" },
  { value: "Seafood", label: "Seafood" },
  { value: "Cafe", label: "Café" },
  { value: "Desserts", label: "Desserts" },
  { value: "", label: "Surprise me" },
];

export const MEALS: Option<Meal>[] = [
  { value: "now", label: "Right now" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];

export const BUDGETS: Option<Budget>[] = [
  { value: "low", label: "Under ₹300" },
  { value: "mid", label: "₹300–700" },
  { value: "high", label: "₹700–1,500" },
  { value: "premium", label: "₹1,500+" },
  { value: "any", label: "Any" },
];

export const DIETS: Option<Diet>[] = [
  { value: "any", label: "Anything" },
  { value: "veg", label: "Veg only" },
  { value: "jain", label: "Jain" },
];

export const RADII: Option<number>[] = [
  { value: 1, label: "1 km" },
  { value: 3, label: "3 km" },
  { value: 5, label: "5 km" },
];

export function defaultMeal(date = new Date()): Meal {
  const h = date.getHours();
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 18 && h < 23) return "dinner";
  return "now";
}
