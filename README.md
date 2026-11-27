# ND Resources

The website at https://neurodivergentresources.co.uk/

- `site/` holds the whole website: `index.html`, `products.json` (the books and products in the shop), `resources.json` (links on the resource pages) and `site.json` (site settings and affiliate tags).
- Every change to `site/` on the `main` branch is uploaded to SiteGround automatically by `.github/workflows/deploy.yml`.
- Before uploading, `scripts/build_pages.cjs` builds `public/`: a ready-made page for every section (`/shop/`, `/families/`, `/professionals/`, `/about/`) and every book (`/books/<id>/`), each with its own title, description, canonical link, sharing tags and schema.org data, plus `sitemap.xml` and `robots.txt`. A new book in `products.json` gets its page on the next deploy. Old `#shop` and `#product-<id>` links forward to the new addresses.
- To build locally: `npm install --no-save playwright-core` then `node scripts/build_pages.cjs` (set `CHROME_PATH` if Chrome is not found).

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
