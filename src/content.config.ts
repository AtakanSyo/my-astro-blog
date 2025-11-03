// src/content.config.ts
import { defineCollection, z } from "astro:content";

const Base = z.object({
  /** routing + meta */
  title: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  writer: z.string().optional(),
  category: z.literal("reviews").or(z.string()).optional(),
  subcategory: z.string().optional(),
  reviewType: z.enum(["hands-on", "research"]).optional(),
  brand: z.string().optional(),

  /** dates (accept string or Date) */
  pubDate: z.coerce.date().optional(),
  date: z.coerce.date().optional(), // fallback if some old posts use `date`

  /** layout + images */
  layout: z.string().optional(),
  cover_image: z.string().optional(),
  imageDir: z.string().optional(),

  /** SEO */
  keywords: z.array(z.string()).nullable().optional(),
});

const ReviewsFields = z.object({
  telescopeType: z.string().optional(), // e.g., "Schmidt-Cassegrain", "Refractor"
  rating: z
    .object({
      overall: z.number().optional(),
      optics: z.number().optional(),
      mount: z.number().optional(),
      accessories: z.number().optional(),
    })
    .partial()
    .optional(),
    affiliate: z
      .object({
        amazon: z.string().nullable().optional(),
        highpointscientific: z.string().nullable().optional(),
        astroshop: z.string().nullable().optional(),
      })
      .partial()
      .optional(),
  specs: z
    .object({
      aperture: z.string().or(z.number()).optional(),
      focalLength: z.string().or(z.number()).optional(),
    })
    .partial()
    .optional(),
});

export const collections = {
  reviews: defineCollection({
    type: "content",
    schema: Base.extend(ReviewsFields.shape),
  }),
  simulations: defineCollection({ type: "content", schema: Base }),
  informational: defineCollection({ type: "content", schema: Base }),
  nasa: defineCollection({ type: "content", schema: Base }),
  tools: defineCollection({ type: "content", schema: Base }),
  // If you keep a generic "posts" collection, you can also add it with Base.
};