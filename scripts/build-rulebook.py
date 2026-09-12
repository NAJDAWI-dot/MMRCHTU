"""
Turns the official rulebook PDF into the assets the /rules flip-book reads.

    py scripts/build-rulebook.py "path/to/Official Rulebook.pdf"

The book shows the PDF's own pages rather than a re-typeset copy, so the design,
the illustrations and the layout are exactly what the organisers exported. What
a picture of a page loses — selectable text, working links — comes back from
the manifest written alongside it.

Outputs are committed. Rendering needs PyMuPDF and Pillow, and nothing in the
deploy pipeline has either, so this runs on an organiser's machine whenever the
PDF changes and never at build time.

Writes, under public/rulebook/:
  MMRC26-Official-Rulebook.pdf   the source, for the download button
  pages/pNN.webp                 each page at 2x for sharp spreads and zoom
  pages/pNN-sm.webp              each page at 1x for phones
  pages/template(-sm).webp       a text-free page in the manual's livery
  pages/cover-art.webp           the cover artwork, for the back board
  manifest.json                  page sizes, text lines and links, in PDF points
"""

import io
import json
import re
import shutil
import sys
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "rulebook"
PAGES = OUT / "pages"
PDF_NAME = "MMRC26-Official-Rulebook.pdf"

# 2x of A4 in points is ~1190px wide: sharp on a retina spread, and enough for
# the zoom view to be worth opening. Past that the files grow faster than the
# pages improve.
SCALE_LARGE = 2.0
SCALE_SMALL = 1.0
QUALITY = 84


def render(page: "fitz.Page", scale: float, target: Path) -> None:
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image = Image.open(io.BytesIO(pix.tobytes("png")))
    image.save(target, "WEBP", quality=QUALITY, method=6)


def text_lines(page: "fitz.Page") -> list[dict]:
    """
    One entry per line rather than per span or word: a line is the unit a reader
    selects and a screen reader reads, and it keeps the manifest small.
    """
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text:
                continue
            x0, y0, x1, y1 = line["bbox"]
            size = max(span["size"] for span in line["spans"])
            lines.append(
                {
                    "text": text,
                    "rect": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                    "size": round(size, 1),
                }
            )
    return lines


def link_label(lines: list[dict], rect: list[float]) -> str:
    """
    The words a contents entry's link covers, minus the dot leader and the page
    number: "6.3 Scoring, and Tie-Breakers". Word puts the number and the title
    on separate lines inside one link, so they are joined left to right.
    """
    x0, y0, x1, y1 = rect
    inside = [
        line
        for line in lines
        if y0 <= (line["rect"][1] + line["rect"][3]) / 2 <= y1 and line["rect"][0] < x1
    ]
    inside.sort(key=lambda line: line["rect"][0])
    text = " ".join(line["text"] for line in inside)
    text = re.sub(r"\s*\.{3,}.*$", "", text)
    return re.sub(r"\s+", " ", text).strip()


def links(page: "fitz.Page") -> list[dict]:
    out = []
    lines = text_lines(page)
    for link in page.get_links():
        r = link["from"]
        rect = [round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)]
        if link["kind"] == fitz.LINK_GOTO:
            # PyMuPDF's page index is zero-based; the book speaks in printed
            # page numbers, which here start at 1 on the cover.
            out.append({"rect": rect, "page": link["page"] + 1, "label": link_label(lines, rect)})
        elif link["kind"] == fitz.LINK_URI:
            out.append({"rect": rect, "uri": link["uri"]})
    return out


def template(doc: "fitz.Document", source_index: int) -> dict:
    """
    A blank page in the manual's own livery, for the pages the book adds.

    The interactive pages have to look like they were bound into the same book,
    and redrawing the header logos and the maze footer by hand would drift from
    the real thing. So a real page is copied and its text removed, keeping the
    header titles; the logos, footer maze and cheese badge are images and line
    art, which the redaction leaves alone. The page number is text too, which
    frees the badge for the book to print its own.
    """
    scratch = fitz.open()
    scratch.insert_pdf(doc, from_page=source_index, to_page=source_index)
    page = scratch[0]
    header_titles = ("HTU Micromouse Contest 2026", "Official Contest Manual")

    badge = None
    body_top = page.rect.height
    body_bottom = 0.0
    for line in text_lines(page):
        x0, y0, x1, y1 = line["rect"]
        if line["text"] in header_titles:
            continue
        if line["text"].isdigit() and y0 > page.rect.height * 0.85:
            badge = line["rect"]
        else:
            body_top = min(body_top, y0)
            body_bottom = max(body_bottom, y1)
        page.add_redact_annot(fitz.Rect(x0 - 1, y0 - 1, x1 + 1, y1 + 1), fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
    )

    render(page, SCALE_LARGE, PAGES / "template.webp")
    render(page, SCALE_SMALL, PAGES / "template-sm.webp")

    # The body box the book's own pages lay out inside: from under the header
    # to above the footer maze, with the manual's left and right margins.
    footer_top = min(
        (info["bbox"][1] for info in page.get_image_info() if info["bbox"][1] > page.rect.height * 0.8),
        default=page.rect.height * 0.9,
    )
    return {
        "src": "/rulebook/pages/template.webp",
        "srcSmall": "/rulebook/pages/template-sm.webp",
        "width": round(page.rect.width, 2),
        "height": round(page.rect.height, 2),
        "body": [60.0, round(body_top - 6, 1), round(page.rect.width - 60, 1), round(footer_top - 4, 1)],
        "badge": badge,
    }


def cover_art(doc: "fitz.Document") -> str:
    """The cover's leather-and-maze artwork, for the back board."""
    cover = doc[0]
    largest = max(cover.get_image_info(xrefs=True), key=lambda info: info["width"] * info["height"])
    image = Image.open(io.BytesIO(doc.extract_image(largest["xref"])["image"])).convert("RGB")
    image.thumbnail((1190, 1684))
    image.save(PAGES / "cover-art.webp", "WEBP", quality=QUALITY, method=6)
    return "/rulebook/pages/cover-art.webp"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1])
    if not source.is_file():
        sys.exit(f"No PDF at {source}")

    PAGES.mkdir(parents=True, exist_ok=True)
    for stale in PAGES.glob("*.webp"):
        stale.unlink()
    shutil.copyfile(source, OUT / PDF_NAME)

    doc = fitz.open(source)
    manifest = {"pdf": f"/rulebook/{PDF_NAME}", "pages": []}
    for index, page in enumerate(doc):
        number = index + 1
        stem = f"p{number:02d}"
        render(page, SCALE_LARGE, PAGES / f"{stem}.webp")
        render(page, SCALE_SMALL, PAGES / f"{stem}-sm.webp")
        manifest["pages"].append(
            {
                "number": number,
                "width": round(page.rect.width, 2),
                "height": round(page.rect.height, 2),
                "src": f"/rulebook/pages/{stem}.webp",
                "srcSmall": f"/rulebook/pages/{stem}-sm.webp",
                "lines": text_lines(page),
                "links": links(page),
            }
        )

    # Page 9 is the sparsest content page, so the least there is to take out.
    manifest["template"] = template(doc, min(8, len(doc) - 1))
    manifest["coverArt"] = cover_art(doc)

    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    link_count = sum(len(p["links"]) for p in manifest["pages"])
    print(f"{len(manifest['pages'])} pages, {link_count} links -> {OUT}")


if __name__ == "__main__":
    main()
