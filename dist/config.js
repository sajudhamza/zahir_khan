/**
 * Where the chef CMS lives.
 *
 * On localhost both values stay blank, so the admin UI talks to the Vite
 * plugin in server/recipeAdmin.js and writes into public/. That keeps
 * `npm run dev` self-contained and — more importantly — stops a local dev
 * server from editing the live site's projects and recipes.
 *
 * Anywhere else it uses the deployed backend. Update these after running
 * ./infra/deploy.sh; note that recreating the Function URL changes its
 * hostname.
 */
;(function () {
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']
  const isLocal = LOCAL_HOSTS.includes(location.hostname)

  window.ZK_CONFIG = isLocal
    ? { apiBase: '', mediaBase: '' }
    : {
        apiBase: 'https://owntwtxuaammw5lkghxubgqqzi0ahmay.lambda-url.us-east-1.on.aws',
        mediaBase: 'https://zahir-khan-cms.s3.us-east-1.amazonaws.com',
      }
})()
