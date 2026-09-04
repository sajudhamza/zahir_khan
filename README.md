# Chef Zahir Khan

Personal site for Chef Zahir Khan, Head Chef at GupShup, Executive Chef at Punjab Meet House — with an admin layer for managing **Projects** (restaurants) and **Recipes** (dishes), same architecture as the Shaila Rizvi studio CMS.

## Run

```bash
npm install
npm run dev
```

Default admin password locally: **`ChefZahir2026!`** (or set `ZAHIR_ADMIN_PASSWORD` in the environment).

## Admin (Login button on /projects and /recipes)

- **Projects** — add/edit/delete a kitchen: project name (the restaurant), description, photos. Optional role, location, and website.
- **Recipes** — add/edit/delete a dish: dish name, ingredients, directions to cook, and photos **or videos**.

Uploads go straight from the browser to storage (presigned URLs in production), so big videos are fine.

## Deploying (Amplify)

The site builds with `npm run build` and publishes `dist/` — see `amplify.yml`.
Being a React Router SPA, Amplify needs the rewrite rule in
`infra/amplify-rewrites.json` so deep links resolve.

Managing projects/recipes **from the live site** also needs the CMS backend:
one Lambda and one S3 bucket. See [`infra/README.md`](infra/README.md) for the
one-time setup and the two config values to put in `public/config.js`.

Without it the published site is read-only: everything renders fine, but Login
can't save anything.

## Local storage layout

On `npm run dev` the same admin UI writes into the repo instead:

- `public/projects/projects.json` + `public/projects/{slug}/` (photos — you can also just drop image files into a project's folder)
- `public/recipes/recipes.json` + `public/recipes/media/{slug}/` (photos + videos)

Official spelling: **Punjab Meet House**.

## Pages

- `/`, Home
- `/projects`, Kitchens + admin manage
- `/projects/:slug`, Project gallery
- `/recipes`, Recipes + admin manage
- `/recipes/:slug`, Recipe (ingredients, directions, photos/videos)
- `/about`, About
- `/contact`, Contact form
