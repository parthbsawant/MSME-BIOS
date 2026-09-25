"""
preprocessor.py — Cleans up a real phone photo of a handwritten bill before
it goes to Claude's vision (Phase B). This is real, working logic, fully
buildable and testable now, with no AI involved at all.

This is also the single most important file in this parser, more so than
for the other two parsers - see docs/PARSER_GUIDE.md Section 2 for why:
there's no structured-extraction fallback here, so image quality going in
is what determines whether extraction is usable at all.
"""

from PIL import Image, ImageOps, ImageEnhance
import io


def preprocess(image_path: str) -> Image.Image:
    """
    Loads an image and applies cleanup steps that help a vision model read
    real handwritten bills more reliably:
      1. Fixes phone auto-rotation (a photo can look upright on your phone
         screen but actually be stored sideways/upside-down in its raw data)
      2. Auto-contrast to even out shadows and uneven lighting
      3. A light sharpness boost to help thin pen strokes read clearly

    Deliberately NOT doing full deskewing/perspective correction here - see
    docs/PARSER_GUIDE.md Section 2 for why that's a reasonable place to stop
    for a first version.
    """
    img = Image.open(image_path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")  # normalize color mode before further processing
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    return img


def preprocess_to_bytes(image_path: str, format: str = "JPEG", quality: int = 90) -> bytes:
    """Runs preprocess() and returns the result as raw bytes, ready to hand
    to msme_bios_shared.extract_structured() as image_bytes."""
    img = preprocess(image_path)
    buffer = io.BytesIO()
    img.save(buffer, format=format, quality=quality)
    return buffer.getvalue()


def save_preprocessed(image_path: str, output_path: str) -> None:
    """Saves the preprocessed image to disk - useful for visually checking
    that preprocessing actually improved the image before wiring up any
    AI calls (see docs/PARSER_GUIDE.md Section 7, step 1: 'test it visually
    before writing any extraction code around it')."""
    img = preprocess(image_path)
    img.save(output_path)
