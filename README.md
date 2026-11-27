# ND Resources

The website at https://neurodivergentresources.co.uk/

- `site/` holds the whole website: `index.html`, `products.json` (the books and products in the shop), `resources.json` (links on the resource pages) and `site.json` (site settings and affiliate tags).
- Every change to `site/` on the `main` branch is uploaded to SiteGround automatically by `.github/workflows/deploy.yml`.

## One-time setup: repository secrets

Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
| --- | --- |
| `SG_HOST` | SiteGround SSH hostname (Site Tools → Devs → SSH Keys Manager → Actions → SSH Credentials) |
| `SG_USER` | SiteGround SSH username (same place) |
| `SG_PORT` | `18765` |
| `SG_KEY` | The private key from SSH Keys Manager → Actions → Private Key |
| `SG_KEY_PASSPHRASE` | The password you chose when creating the key |

Optional: `SG_PATH` if the site is not in `www/neurodivergentresources.co.uk/public_html`.
