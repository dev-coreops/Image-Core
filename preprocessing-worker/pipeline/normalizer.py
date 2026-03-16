import logging
import os

from PIL import Image, ExifTags

logger = logging.getLogger(__name__)

FORMAT_EXTENSION_MAP = {
    "jpeg": "jpg",
    "png": "png",
    "webp": "webp",
    "bmp": "bmp",
    "tiff": "tiff",
}

PIL_FORMAT_MAP = {
    "jpeg": "JPEG",
    "png": "PNG",
    "webp": "WEBP",
    "bmp": "BMP",
    "tiff": "TIFF",
}

VALID_FORMATS = set(PIL_FORMAT_MAP.keys())


def _fix_orientation(image: Image.Image) -> Image.Image:
    """Auto-rotate image based on EXIF orientation tag."""
    try:
        exif = image.getexif()
        orientation_key = None
        for key, val in ExifTags.TAGS.items():
            if val == "Orientation":
                orientation_key = key
                break

        if orientation_key and orientation_key in exif:
            orientation = exif[orientation_key]
            if orientation == 3:
                image = image.rotate(180, expand=True)
            elif orientation == 6:
                image = image.rotate(270, expand=True)
            elif orientation == 8:
                image = image.rotate(90, expand=True)
    except Exception:
        pass
    return image


def normalize(images: list[dict], config: dict) -> list[dict]:
    """Normalize images: format conversion, EXIF fix, RGB conversion."""
    target_format = config.get("target_format", "jpeg")
    target_quality = config.get("target_quality", 95)
    fix_orientation = config.get("fix_orientation", True)
    convert_rgb = config.get("convert_rgb", True)
    max_dimension = config.get("max_dimension")

    # Validate target_format
    if target_format not in VALID_FORMATS:
        raise ValueError(
            f"Invalid target_format '{target_format}'. "
            f"Must be one of: {', '.join(sorted(VALID_FORMATS))}"
        )

    pil_format = PIL_FORMAT_MAP[target_format]
    ext = FORMAT_EXTENSION_MAP[target_format]

    normalized = []

    for img_info in images:
        local_path = img_info["local_path"]
        filename = img_info["filename"]

        try:
            with Image.open(local_path) as im:
                # Fix EXIF orientation
                if fix_orientation:
                    im = _fix_orientation(im)

                # Convert to RGB
                if convert_rgb and im.mode != "RGB":
                    im = im.convert("RGB")

                # Resize if max_dimension is set
                if max_dimension:
                    w, h = im.size
                    if w > max_dimension or h > max_dimension:
                        ratio = min(max_dimension / w, max_dimension / h)
                        new_size = (int(w * ratio), int(h * ratio))
                        im = im.resize(new_size, Image.LANCZOS)

                # Build output filename
                base_name = os.path.splitext(filename)[0]
                out_filename = f"{base_name}.{ext}"
                out_path = os.path.join(os.path.dirname(local_path), out_filename)

                # Save with stripped EXIF
                save_kwargs = {}
                if pil_format == "JPEG":
                    save_kwargs["quality"] = target_quality
                    save_kwargs["optimize"] = True

                # Create a clean image without EXIF
                clean = Image.new(im.mode, im.size)
                clean.putdata(list(im.getdata()))
                clean.save(out_path, pil_format, **save_kwargs)

                width, height = clean.size
                clean.close()

                normalized.append({
                    **img_info,
                    "local_path": out_path,
                    "filename": out_filename,
                    "width": width,
                    "height": height,
                    "format": target_format,
                })

        except Exception as e:
            logger.warning("Normalization failed for %s: %s", filename, e)

    return normalized
