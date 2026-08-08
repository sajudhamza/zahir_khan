# Chef Zahir Khan

Personal site for Chef Zahir Khan — Head Chef at GupShup, Executive Chef at Punjab Meet House.

## Run

```bash
cd "/Users/cyril/Downloads/Companies Startup/Zahir-Khan"
npm install
npm run dev
```

Default admin password: **`ChefZahir2026!`** (or set `ZAHIR_ADMIN_PASSWORD` in `.env`).

## Recipes admin

1. Open `/recipes` → **Login**
2. Add dish name, steps (one per line), pictures → **Publish**
3. Files land in `public/recipes/`

## Projects

Folders (drop photos here):

- `public/projects/gupshup/`
- `public/projects/chote-miya/`
- `public/projects/ammi/`
- `public/projects/punjab-meet-house/`

While `npm run dev` is running, refresh `/projects` to see new images. Login on that page to edit text or upload more photos.

Official spelling: **Punjab Meet House**.

## Pages

- `/` — Home
- `/projects` — Kitchens + admin edit
- `/projects/:slug` — Project gallery
- `/recipes` — Recipes + admin
- `/about` — About
- `/contact` — Contact form
