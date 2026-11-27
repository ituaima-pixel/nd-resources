"""Download a cover image for every shop product that does not have one yet.

Looks up each book on Open Library (by ISBN when known, otherwise by title and
author) and saves the cover to site/images/<product id>.jpg. Products that
already have a cover file are skipped, so this only fetches new books.
"""
import json, os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS = os.path.join(ROOT, "site", "products.json")
IMAGES = os.path.join(ROOT, "site", "images")
UA = {"User-Agent": "nd-resources-site-cover-fetch/1.0"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def cover_for(p):
    for url in p.get("coverUrls", []):
        try:
            data = get(url)
            if len(data) > 2000 and (data[:2] == b"\xff\xd8" or data[:8] == b"\x89PNG\r\n\x1a\n" or data[8:12] == b"WEBP"):
                return data
        except Exception as e:
            print(f"  {url[:60]}: {e}")
    if p.get("openLibraryCoverId"):
        return get(f"https://covers.openlibrary.org/b/id/{p['openLibraryCoverId']}-L.jpg")
    isbn = p.get("isbn") or next((b.get("isbn") for b in p.get("buy", []) if b.get("isbn")), None)
    if isbn:
        try:
            data = get(f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false")
            if len(data) > 2000:
                return data
        except Exception:
            pass
    author = p.get("author", "").replace("(eds)", "").replace("(ed.)", "").split(" and ")[0].split(",")[0]
    q = urllib.parse.urlencode({"title": p["title"], "author": author, "limit": 5, "fields": "cover_i,title"})
    try:
        docs = json.loads(get(f"https://openlibrary.org/search.json?{q}")).get("docs", [])
    except Exception as e:
        print(f"  search failed: {e}")
        return None
    for d in docs:
        if d.get("cover_i"):
            data = get(f"https://covers.openlibrary.org/b/id/{d['cover_i']}-L.jpg")
            if len(data) > 2000:
                return data
    # Fallback: Google Books
    gq = f"isbn:{isbn}" if isbn else f'intitle:"{p["title"]}" inauthor:"{author}"'
    try:
        items = json.loads(get("https://www.googleapis.com/books/v1/volumes?" + urllib.parse.urlencode({"q": gq, "maxResults": 3}))).get("items", [])
    except Exception as e:
        print(f"  Google Books lookup failed: {e}")
        items = []
    for it in items:
        links = it.get("volumeInfo", {}).get("imageLinks", {})
        url = links.get("thumbnail") or links.get("smallThumbnail")
        if url:
            url = url.replace("http://", "https://").replace("&edge=curl", "").replace("zoom=1", "zoom=3")
            try:
                data = get(url)
            except Exception:
                data = get(url.replace("zoom=3", "zoom=1"))
            if len(data) > 2000:
                return data
    return None


def main():
    os.makedirs(IMAGES, exist_ok=True)
    products = json.load(open(PRODUCTS))
    added = 0
    for p in products:
        path = os.path.join(IMAGES, p["id"] + ".jpg")
        if os.path.exists(path) or p.get("coverLookup") is False:
            continue
        print(f"Looking up cover: {p['title']}")
        data = cover_for(p)
        if data:
            open(path, "wb").write(data)
            added += 1
            print("  saved")
        else:
            print("  no cover found, the site will show a plain cover")
        time.sleep(1)
    print(f"{added} new cover(s)")


if __name__ == "__main__":
    sys.exit(main())
