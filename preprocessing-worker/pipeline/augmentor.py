import logging
import os

import albumentations as A
import cv2
import numpy as np

logger = logging.getLogger(__name__)

TRANSFORM_MAP = {
    "horizontal_flip": lambda prob, **kw: A.HorizontalFlip(p=prob),
    "vertical_flip": lambda prob, **kw: A.VerticalFlip(p=prob),
    "rotation": lambda prob, **kw: A.Rotate(limit=kw.get("limit", 15), p=prob),
    "rotate": lambda prob, **kw: A.Rotate(limit=kw.get("limit", 15), p=prob),
    "brightness_contrast": lambda prob, **kw: A.RandomBrightnessContrast(
        brightness_limit=kw.get("brightness_limit", 0.2), p=prob
    ),
    "gaussian_blur": lambda prob, **kw: A.GaussianBlur(p=prob),
    "blur": lambda prob, **kw: A.GaussianBlur(p=prob),
    "gaussian_noise": lambda prob, **kw: A.GaussNoise(p=prob),
    "noise": lambda prob, **kw: A.GaussNoise(p=prob),
    "random_crop": lambda prob, **kw: A.RandomResizedCrop(
        size=(kw.get("height", 224), kw.get("width", 224)), p=prob
    ),
    "color_jitter": lambda prob, **kw: A.ColorJitter(p=prob),
    "channel_shuffle": lambda prob, **kw: A.ChannelShuffle(p=prob),
}


def augment(images: list[dict], config: dict) -> list[dict]:
    """Generate augmented copies of images."""
    operations = config.get("operations", [])
    augmentations_per_image = config.get("augmentations_per_image", 2)

    if not operations:
        return []

    # Build albumentations pipeline
    transforms = []
    for op in operations:
        op_type = op.get("type")
        probability = op.get("probability", 0.5)
        builder = TRANSFORM_MAP.get(op_type)
        if builder:
            # Filter out None values so defaults in lambdas take effect
            clean_op = {k: v for k, v in op.items() if v is not None}
            transforms.append(builder(probability, **clean_op))

    if not transforms:
        return []

    pipeline = A.Compose(transforms)
    augmented = []

    for img_info in images:
        local_path = img_info["local_path"]
        filename = img_info["filename"]
        base_name = os.path.splitext(filename)[0]
        ext = os.path.splitext(filename)[1]

        try:
            image = cv2.imread(local_path)
            if image is None:
                continue
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            for i in range(augmentations_per_image):
                result = pipeline(image=image)
                aug_image = result["image"]

                aug_filename = f"{base_name}_aug_{i + 1}{ext}"
                aug_path = os.path.join(os.path.dirname(local_path), aug_filename)

                aug_bgr = cv2.cvtColor(aug_image, cv2.COLOR_RGB2BGR)
                cv2.imwrite(aug_path, aug_bgr)

                h, w = aug_image.shape[:2]
                augmented.append({
                    "local_path": aug_path,
                    "filename": aug_filename,
                    "width": w,
                    "height": h,
                    "format": img_info.get("format", "jpeg"),
                    "content_hash": None,
                    "perceptual_hash": None,
                })

        except Exception as e:
            logger.warning("Augmentation failed for %s: %s", filename, e)

    return augmented
