import logging
import os

from PIL import Image

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {"jpeg", "jpg", "png", "webp", "bmp", "tiff"}

FORMAT_MIME_MAP = {
    "JPEG": "jpeg",
    "PNG": "png",
    "WEBP": "webp",
    "BMP": "bmp",
    "TIFF": "tiff",
}


def validate(images: list[dict], config: dict) -> tuple[list[dict], list[dict]]:
    """Validate images. Returns (valid, excluded) lists."""
    min_width = config.get("min_width", 32)
    min_height = config.get("min_height", 32)
    max_file_size_mb = config.get("max_file_size_mb", 50)
    allowed_formats = {f.lower() for f in config.get("allowed_formats", SUPPORTED_FORMATS)}

    valid = []
    excluded = []

    for img_info in images:
        local_path = img_info["local_path"]
        filename = img_info["filename"]

        # Check file exists and is not zero-byte
        if not os.path.exists(local_path):
            excluded.append({**img_info, "reason": "file_not_found"})
            continue
        if os.path.getsize(local_path) == 0:
            excluded.append({**img_info, "reason": "empty_file"})
            continue

        # Check file size
        size_mb = os.path.getsize(local_path) / (1024 * 1024)
        if size_mb > max_file_size_mb:
            excluded.append({**img_info, "reason": f"too_large:{size_mb:.1f}MB"})
            continue

        # Try opening with Pillow
        try:
            with Image.open(local_path) as im:
                im.verify()

            # Re-open after verify (verify closes the image)
            with Image.open(local_path) as im:
                width, height = im.size
                pil_format = FORMAT_MIME_MAP.get(im.format, "").lower()

                # Check format
                if pil_format not in allowed_formats:
                    excluded.append({**img_info, "reason": f"unsupported_format:{pil_format or im.format}"})
                    continue

                # Check dimensions
                if width < min_width or height < min_height:
                    excluded.append({**img_info, "reason": f"too_small:{width}x{height}"})
                    continue

                img_info["width"] = width
                img_info["height"] = height
                img_info["format"] = pil_format
                valid.append(img_info)

        except Exception as e:
            logger.warning("Validation failed for %s: %s", filename, e)
            excluded.append({**img_info, "reason": f"corrupt:{type(e).__name__}"})

    return valid, excluded
