// Builds the website that gets uploaded, in public/.
//
// The site is still one page (site/index.html) that draws itself from products.json,
// resources.json and site.json. This script opens that page in a headless browser for
// every address (home, /shop/, /families/, /professionals/, /about/, guides such as
// /professionals/<guide-id>/ from guides.json, and /books/<id>/),
// saves the finished page as its own HTML file, and adds the details search engines
// read: a unique title and description, a canonical link, social sharing tags and
// schema.org data. It also writes sitemap.xml and robots.txt.
//
// Adding a book only needs a new entry in site/products.json; its page appears on the next deploy.
//
// Run: node scripts/build_pages.cjs   (needs playwright or playwright-core and a Chrome/Chromium)

const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "site");
const OUT = path.join(ROOT, "public");
const ORIGIN = "https://neurodivergentresources.co.uk";
const SITE_NAME = "ND Resources";

let chromium;
try { ({ chromium } = require("playwright-core")); } catch (e) { ({ chromium } = require("playwright")); }

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
const products = readJson("products.json");
const guides = fs.existsSync(path.join(SRC, "guides.json")) ? readJson("guides.json") : [];
const template = fs.readFileSync(path.join(SRC, "index.html"), "utf8");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n = 158) => { s = String(s || "").replace(/\s+/g, " ").trim(); if (s.length <= n) return s; const cut = s.slice(0, n - 1); return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "") + "…"; };
const AUD = { parents: "parents and carers", adults: "autistic and ADHD adults", children: "children", professionals: "professionals", prescribing: "prescribers", families: "individuals and families" };
const jsonLd = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, "\\u003c") + "</script>";
const crumbs = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: ORIGIN + url })) });
function authors(a) {
  return String(a || "").split(/\s*(?:,|;|&|\band\b)\s*/).map((x) => x.trim()).filter((x) => x && !/^(et al\.?|ed\.?|eds\.?)$/i.test(x)).map((name) => ({ "@type": "Person", name }));
}

const books = products.filter((p) => p.kind === "book");
const ORG = { "@type": "Organization", "@id": ORIGIN + "/#org", name: SITE_NAME, url: ORIGIN + "/" };

// Every page: address, title, description, extra schema.org data
const pages = [
  {
    url: "/", title: "ND Resources: autism and ADHD books and resources (UK)",
    description: "Clear, calm resources and recommended books about autism and ADHD for neurodivergent people, families and professionals in the UK.",
    ld: [{ "@context": "https://schema.org", "@graph": [ORG, { "@type": "WebSite", "@id": ORIGIN + "/#site", name: SITE_NAME, url: ORIGIN + "/", inLanguage: "en-GB", publisher: { "@id": ORIGIN + "/#org" } }] }],
  },
  {
    url: "/shop/", title: "Autism and ADHD books for families and professionals | ND Resources",
    description: `${books.length} recommended books about autism, ADHD, AuDHD and PDA for parents and carers, autistic and ADHD adults, children and professionals, with plain-language summaries.`,
    ld: [crumbs([["Home", "/"], ["Shop", "/shop/"]]), { "@context": "https://schema.org", "@type": "ItemList", name: "Recommended books about autism and ADHD", itemListElement: books.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${ORIGIN}/books/${p.id}/`, name: p.title })) }],
  },
  {
    url: "/families/", title: "Autism and ADHD help for individuals and families | ND Resources",
    description: "Free, trusted UK links for autistic and ADHD people and their families: after a diagnosis, waiting for an assessment, school support and where to get help now.",
    ld: [crumbs([["Home", "/"], ["For you and your family", "/families/"]])],
  },
  {
    url: "/professionals/", title: "Neuro-affirming autism and ADHD resources for professionals | ND Resources",
    description: "UK-focused guidance, neuro-affirming practice principles and recommended books for teachers, SENCOs, clinicians, therapists and support workers.",
    ld: [crumbs([["Home", "/"], ["For professionals", "/professionals/"]])],
  },
  {
    url: "/about/", title: "About ND Resources",
    description: "Who ND Resources is for, how the site is designed to be accessible and easy on the senses, and how book recommendations and links work.",
    ld: [crumbs([["Home", "/"], ["About", "/about/"]])],
  },
  ...guides.map((g) => {
    const url = `/${g.parent}/${encodeURIComponent(g.id)}/`;
    const parentName = g.parent === "professionals" ? "For professionals" : "For you and your family";
    const article = { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, url: ORIGIN + url, inLanguage: "en-GB", publisher: { "@id": ORIGIN + "/#org" }, isPartOf: { "@id": ORIGIN + "/#site" }, citation: (g.sources || []).map((s) => s.url) };
    return { url, title: g.metaTitle || `${g.title} | ${SITE_NAME}`, description: clip(g.description), ld: [article, crumbs([["Home", "/"], [parentName, `/${g.parent}/`], [g.title, url]])] };
  }),
  ...products.map((p) => {
    const url = `/books/${encodeURIComponent(p.id)}/`;
    const by = p.author ? ` by ${p.author}` : "";
    let title = `${p.title}${by} | ${SITE_NAME}`;
    if (title.length > 70) title = `${p.title} | ${SITE_NAME}`;
    const forWho = (p.audience || []).map((a) => AUD[a] || a);
    const description = clip(p.summary || `${p.title}${by}${p.subtitle ? ": " + p.subtitle : ""}.`) ;
    const image = p.kind === "book" && fs.existsSync(path.join(SRC, "images", p.id + ".jpg")) ? `${ORIGIN}/images/${p.id}.jpg` : null;
    const book = {
      "@context": "https://schema.org", "@type": p.kind === "book" ? "Book" : "CreativeWork",
      name: p.title, url: ORIGIN + url, description: p.summary || undefined,
      alternativeHeadline: p.subtitle || undefined,
      author: authors(p.author).length ? authors(p.author) : undefined,
      publisher: p.publisher ? { "@type": "Organization", name: p.publisher } : undefined,
      isbn: p.isbn || undefined, numberOfPages: Number(p.pages) || undefined, bookEdition: p.edition || undefined,
      genre: p.topic || undefined, keywords: (p.tags || []).join(", ") || undefined,
      audience: forWho.length ? { "@type": "Audience", audienceType: forWho.join(", ") } : undefined,
      image: image || undefined, inLanguage: "en",
    };
    return { url, title, description, image, type: "book", ld: [book, crumbs([["Home", "/"], ["Shop", "/shop/"], [p.title, url]])] };
  }),
];

function headTags(pg) {
  const canonical = ORIGIN + pg.url;
  return [
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="en_GB">`,
    `<meta property="og:type" content="${pg.type === "book" ? "book" : "website"}">`,
    `<meta property="og:title" content="${esc(pg.title)}">`,
    `<meta property="og:description" content="${esc(pg.description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    pg.image ? `<meta property="og:image" content="${esc(pg.image)}">` : "",
    `<meta name="twitter:card" content="${pg.image ? "summary" : "summary"}">`,
    ...pg.ld.map(jsonLd),
  ].filter(Boolean).join("\n");
}

function finish(html, pg) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(pg.title)}</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(pg.description)}">`);
  html = html.replace(/<\/head>/, headTags(pg) + "\n</head>");
  html = html.replace(/ data-rendered="1"/, "");
  return "<!doctype html>\n" + html.replace(/^<!doctype html>\s*/i, "");
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

const TYPES = { ".html": "text/html", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css", ".js": "text/javascript" };
function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(SRC, p);
    if (file.startsWith(SRC) && fs.existsSync(file) && fs.statSync(file).isFile() && !p.endsWith(".html")) {
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(template); // every address gets the same page; its script picks the view from the address
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(SRC, OUT);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext();
  // Outside requests (fonts) are not needed to draw the page
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const out = [];
  for (const pg of pages) {
    await page.goto(base + pg.url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("html[data-rendered]", { timeout: 15000 });
    const html = await page.evaluate(() => {
      const view = document.getElementById("view"), h1 = view.querySelector("h1");
      if (!h1 || /not found/i.test(h1.textContent)) return null;
      view.setAttribute("data-prerendered", "1");
      return document.documentElement.outerHTML;
    });
    if (!html) throw new Error("Page did not render: " + pg.url);
    out.push([pg, finish(html, pg)]);
  }
  await browser.close();
  server.close();
  if (errors.length) throw new Error("Script errors while building pages:\n" + errors.join("\n"));

  for (const [pg, html] of out) {
    const dir = path.join(OUT, decodeURIComponent(pg.url));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
  }

  fs.writeFileSync(path.join(OUT, "sitemap.xml"),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map((pg) => `  <url><loc>${esc(ORIGIN + pg.url)}</loc></url>`).join("\n") + "\n</urlset>\n");
  fs.writeFileSync(path.join(OUT, "robots.txt"),
    "User-agent: *\nAllow: /\nDisallow: /old-wordpress/\n\nSitemap: " + ORIGIN + "/sitemap.xml\n");

  console.log(`Built ${out.length} pages, sitemap.xml and robots.txt in public/`);
})().catch((e) => { console.error(e); process.exit(1); });
