/// <reference path="../.astro/types.d.ts" />

import type { SessionData } from './lib/auth.js';

declare global {
  namespace App {
    interface Locals {
      session?: SessionData;
    }
  }
}

export {};
