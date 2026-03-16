import hashlib
import logging

import imagehash
from PIL import Image

logger = logging.getLogger(__name__)

HASH_METHODS = {
    "phash": imagehash.phash,
    "dhash": imagehash.dhash,
    "ahash": imagehash.average_hash,
    "whash": imagehash.whash,
}


def _compute_content_hash(file_path: str) -> str:
    """Compute SHA-256 hash of file content."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return f"sha256:{sha256.hexdigest()}"


def deduplicate(images: list[dict], config: dict) -> tuple[list[dict], list[dict]]:
    """Deduplicate images using perceptual hashing."""
    method_name = config.get("method", "phash")
    hash_size = config.get("hash_size", 16)
    threshold = config.get("threshold", 8)

    hash_func = HASH_METHODS.get(method_name, imagehash.phash)

    # Compute hashes
    hashed_images = []
    for img_info in images:
        try:
            with Image.open(img_info["local_path"]) as im:
                perceptual = hash_func(im, hash_size=hash_size)

            content_hash = _compute_content_hash(img_info["local_path"])

            hashed_images.append({
                **img_info,
                "perceptual_hash": str(perceptual),
                "content_hash": content_hash,
                "_hash_obj": perceptual,
            })
        except Exception as e:
            logger.warning("Hashing failed for %s: %s", img_info["filename"], e)
            hashed_images.append({
                **img_info,
                "perceptual_hash": None,
                "content_hash": None,
                "_hash_obj": None,
            })

    # Find duplicates
    kept = []
    excluded = []
    seen_hashes: list[tuple[imagehash.ImageHash, str]] = []

    for img in hashed_images:
        hash_obj = img.pop("_hash_obj", None)

        if hash_obj is None:
            kept.append(img)
            continue

        is_duplicate = False
        for seen_hash, seen_id in seen_hashes:
            if abs(hash_obj - seen_hash) < threshold:
                excluded.append({**img, "reason": f"duplicate_of:{seen_id}"})
                is_duplicate = True
                break

        if not is_duplicate:
            kept.append(img)
            seen_hashes.append((hash_obj, img.get("filename", "")))

    return kept, excluded
