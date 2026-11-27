"""Collect possible covers for books that have none, for a person to check."""
import json, os, time, urllib.parse, urllib.request
UA = {"User-Agent": "nd-resources-site-cover-fetch/1.0"}
OUT = "cover-candidates"
os.makedirs(OUT, exist_ok=True)

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()

products = json.load(open("site/products.json"))
missing = [p for p in products if not os.path.exists(f"site/images/{p['id']}.jpg")]
for p in missing:
    author = p.get("author", "").replace("(eds)", "").replace("(ed.)", "").split(" and ")[0].split(",")[0].strip()
    n = 0
    print(f"== {p['id']}")
    # Open Library: every doc with a cover
    try:
        q = urllib.parse.urlencode({"q": f"{p['title']} {author}", "limit": 5, "fields": "cover_i,title,author_name,isbn"})
        for d in json.loads(get(f"https://openlibrary.org/search.json?{q}")).get("docs", []):
            print("   OL doc:", d.get("title"), d.get("author_name"), "cover", d.get("cover_i"))
            if d.get("cover_i"):
                data = get(f"https://covers.openlibrary.org/b/id/{d['cover_i']}-L.jpg")
                if len(data) > 2000:
                    n += 1; open(f"{OUT}/{p['id']}__ol{n}.jpg", "wb").write(data)
    except Exception as e:
        print("   OL failed", e)
    # Google Books with retries
    gq = urllib.parse.urlencode({"q": f'intitle:"{p["title"]}" inauthor:"{author}"', "maxResults": 4})
    for attempt in range(4):
        try:
            items = json.loads(get(f"https://www.googleapis.com/books/v1/volumes?{gq}")).get("items", [])
            for it in items:
                v = it.get("volumeInfo", {})
                links = v.get("imageLinks", {})
                print("   GB:", v.get("title"), v.get("authors"), v.get("publishedDate"), bool(links))
                url = links.get("thumbnail")
                if url:
                    url = url.replace("http://", "https://").replace("&edge=curl", "")
                    for z in ("zoom=3", "zoom=1"):
                        try:
                            data = get(url.replace("zoom=1", z))
                            if len(data) > 2000:
                                n += 1; open(f"{OUT}/{p['id']}__gb{n}.jpg", "wb").write(data); break
                        except Exception:
                            pass
            break
        except Exception as e:
            print("   GB attempt failed", e); time.sleep(20)
    time.sleep(2)
