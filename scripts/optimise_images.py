"""Shrinks large book covers in the built site (public/images) so pages load faster.

Covers show at most about 300px wide, so anything over 900px on its longest side is
scaled down and saved as a web-quality JPEG. The originals in site/images are not changed.
Run: python3 scripts/optimise_images.py public/images
"""
import os
import sys

from PIL import Image

MAX_SIDE = 900
folder = sys.argv[1] if len(sys.argv) > 1 else "public/images"
before = after = 0
for name in sorted(os.listdir(folder)):
    if not name.lower().endswith((".jpg", ".jpeg")):
        continue
    path = os.path.join(folder, name)
    size = os.path.getsize(path)
    before += size
    try:
        with Image.open(path) as im:
            if max(im.size) <= MAX_SIDE and size <= 150_000:
                after += size
                continue
            im = im.convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            im.save(path + ".tmp", "JPEG", quality=82, optimize=True, progressive=True)
        if os.path.getsize(path + ".tmp") < size:
            os.replace(path + ".tmp", path)
        else:
            os.remove(path + ".tmp")
    except Exception as e:  # a broken file is left as it is
        print(f"Skipped {name}: {e}")
    after += os.path.getsize(path)
print(f"Covers: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")
