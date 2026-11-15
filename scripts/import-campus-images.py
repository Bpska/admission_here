"""Import Commons campus photographs with source and license attribution."""
import json
import pathlib
import re
import subprocess
import urllib.parse
import html

ROOT = pathlib.Path(__file__).resolve().parents[1]
PHOTOS = {
    "nit-rourkela": ["NIT Rourkela main building.jpg", "NIT Rourkela main gate.jpg", "Homi Bhabha Hall of Residence.jpg"],
    "iit-bombay": ["IITBMainBuildingCROP.jpg", "IITB Library Building.JPG", "IITBConvocationHall.JPG"],
    "iit-bhubaneswar": ["936 acre campus - a view from the Barunei Hill.jpg", "Campus View (1).jpg", "Main Gate of iitbbs.jpg"],
    "bits-pilani": ["BITS Pilani.jpg"],
    "iim-ahmedabad": ["IIM Ahmedabad New Campus.JPG", "Indian Institute of Management Ahmedabad, entrance.jpg", "Vikram Sarabhai Library Reading Room.JPG"],
}

def fetch(url):
    return subprocess.check_output(["curl", "-fsSL", "--retry", "2", "--max-time", "45", url])

def plain(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()

if __name__ == "__main__":
    catalog = {}
    for slug, titles in PHOTOS.items():
        params = dict(action="query", titles="|".join("File:" + title for title in titles),
                      prop="imageinfo", iiprop="url|extmetadata", iiurlwidth="1200", format="json")
        data = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
        catalog[slug] = []
        for page in data["query"]["pages"].values():
            info = page["imageinfo"][0]
            metadata = info["extmetadata"]
            license_name = plain(metadata["LicenseShortName"]["value"])
            if not license_name.startswith(("CC BY", "CC0", "Public domain")):
                raise ValueError("Unsupported license: " + license_name)
            filename = re.sub(r"[^a-z0-9]+", "-", page["title"][5:].rsplit(".", 1)[0].lower()) + ".jpg"
            url = info.get("thumburl", info["url"]).split("?")[0]
            content = fetch(url)
            if not content.startswith(b"\xff\xd8"):
                raise ValueError("Expected JPEG: " + url)
            target = ROOT / "public/images/campuses" / slug / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            catalog[slug].append(dict(src="/images/campuses/" + slug + "/" + filename,
                title=page["title"][5:].rsplit(".", 1)[0], source=info["descriptionurl"],
                author=plain(metadata.get("Artist", {}).get("value", "Wikimedia Commons contributor")),
                license=license_name, licenseUrl=metadata.get("LicenseUrl", {}).get("value", "https://commons.wikimedia.org")))
            print(slug, filename, len(content), flush=True)
        (ROOT / "src/data/campus-photos.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
