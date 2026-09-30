import { z } from "zod";
import { categories, normalizeCategory } from "./taxonomy";
export { categories } from "./taxonomy";
export const pricingModels = [
  "free",
  "freemium",
  "paid",
  "contact",
  "unknown",
] as const;
export const pricingLabels: Record<string, string> = {
  free: "Free",
  freemium: "Free + paid plans",
  paid: "Paid",
  contact: "Contact for pricing",
  unknown: "Pricing not provided",
};
export const companySchema = z.object({
  name: z.string().trim().min(2).max(60),
  url: z.string().url().max(500),
  tagline: z.string().trim().min(5).max(80),
  description: z.string().trim().max(2000).default(""),
  category: z.preprocess(
    (value) => (typeof value === "string" ? normalizeCategory(value) : value),
    z.enum(categories),
  ),
  what_it_does: z.string().trim().max(400).default(""),
  target_audience: z.string().trim().max(200).default(""),
  pricing_model: z.enum(pricingModels).default("unknown"),
  pricing_note: z.string().trim().max(200).default(""),
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(30)
        .regex(/^[a-z0-9][a-z0-9 +.-]*$/),
    )
    .max(8)
    .default([])
    .transform((v) => [...new Set(v)]),
  logo_url: z.string().min(1).max(1000),
  hero_image_url: z.string().min(1).max(1000),
  social_url: z.string().url().max(500).optional().or(z.literal("")),
});
export const authSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const backSchema = z.object({
  companyId: z.string().uuid(),
  seasonId: z.string().uuid().optional(),
  turnstileToken: z.string().max(2048).optional(),
  source: z.string().max(200).optional(),
  surface: z.enum(["feed", "profile"]).default("profile"),
});
export const checkoutSchema = z.object({
  companyId: z.string().uuid(),
  amount: z.number().int().min(1).max(100000),
  email: z.string().email(),
});
export const placementSchema = z.object({
  advertiser: z.string().trim().min(2).max(60),
  creative: z.string().trim().min(5).max(100),
  destination_url: z.string().url(),
  position: z.enum(["top", "bottom", "both", "deck"]),
  description: z.string().trim().min(10).max(400),
  logo_url: z.string().min(1).max(1000),
  hero_image_url: z.string().min(1).max(1000),
  cta_label: z.string().trim().min(2).max(30).default("Visit sponsor"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Choose a valid calendar date."),
  days: z.number().int().min(1).max(30),
  email: z.string().email(),
});
