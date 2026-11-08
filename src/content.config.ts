import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One YAML file per event in src/content/events/. The filename is the event's
// id (e.g. 2026-11-18-mini-bundt-cakes) and also keys its photos in
// src/data/photos.json.
const events = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    // YYYY-MM-DD (Princeton local date). YAML turns a bare date into a Date at
    // UTC midnight, so normalize that back to the plain string.
    date: z.union([z.iso.date(), z.date().transform((d) => d.toISOString().slice(0, 10))]),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'use 24h HH:mm, e.g. 19:00')
      .optional(), // omit while the time is TBA
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    location: z.string().optional(), // omit while TBA
    kind: z.enum(['bake-night', 'collab', 'special']),
    partner: z.string().optional(), // collab partner org, full name
    partnerShort: z.string().optional(), // e.g. "CLA" → shown as "BB × CLA"
    bake: z.string().optional(), // what we made
    blurb: z.string().optional(),
    // Phase 2 (signup drops). Not used by the site yet.
    signup: z
      .object({
        opensAt: z.iso.datetime({ offset: true }),
        capacity: z.number().int().positive(),
      })
      .optional(),
  }),
});

export const collections = { events };
