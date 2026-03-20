import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

import { keys as analytics } from '@workspace/analytics/keys';
import { keys as auth } from '@workspace/auth/keys';
import { keys as billing } from '@workspace/billing/keys';
import { keys as database } from '@workspace/database/keys';
import { keys as email } from '@workspace/email/keys';
import { keys as monitoring } from '@workspace/monitoring/keys';
import { keys as routes } from '@workspace/routes/keys';

export const env = createEnv({
  extends: [
    analytics(),
    auth(),
    billing(),
    database(),
    email(),
    monitoring(),
    routes()
  ],
  server: {
    // AI — GEMINI_API_KEY is already present for Gemini (image gen + creative copy)
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    // Web scraping for campaign agents (brand + landing page analysis)
    FIRECRAWL_API_KEY: z.string().optional(),
    // Google Ads connector
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_DEVELOPER_TOKEN: z.string().optional(),
    // Microsoft Advertising (Bing) connector
    BING_CLIENT_ID: z.string().optional(),
    BING_CLIENT_SECRET: z.string().optional(),
    BING_DEVELOPER_TOKEN: z.string().optional(),
    // Meta connector
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional()
  },
  client: {},
  runtimeEnv: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_DEVELOPER_TOKEN: process.env.GOOGLE_DEVELOPER_TOKEN,
    BING_CLIENT_ID: process.env.BING_CLIENT_ID,
    BING_CLIENT_SECRET: process.env.BING_CLIENT_SECRET,
    BING_DEVELOPER_TOKEN: process.env.BING_DEVELOPER_TOKEN,
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET
  }
});
