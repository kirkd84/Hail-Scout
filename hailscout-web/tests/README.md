# E2E Tests

End-to-end testing with Playwright. Tests are skipped in Week 1 but the structure is ready for Month 2.

## Strategy

1. **Auth flows** — sign-up, sign-in, sign-out
2. **Map page** — address search, storm list, detail sheet
3. **Sidebar navigation** — page transitions
4. **Responsive design** — mobile, tablet, desktop

## Setup

```bash
npm install -D @playwright/test
```

## Running Tests

```bash
npm run test:e2e
```

## Example Test

```typescript
import { test, expect } from "@playwright/test";

test("user can sign up", async ({ page }) => {
  await page.goto("/sign-up");
  await page.fill("input[name='email']", "test@example.com");
  // ... more interactions
  await expect(page).toHaveURL("/app/map");
});
```

See `@playwright/test` docs for full API.
