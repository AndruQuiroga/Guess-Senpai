"""Deterministic poster effects. Anime popularity determines round difficulty."""

from __future__ import annotations

import io
import random
from typing import Literal

from PIL import Image, ImageEnhance

Modification = Literal["black_white", "mosaic", "shuffled"]
MODIFICATIONS: tuple[Modification, ...] = ("black_white", "mosaic", "shuffled")


def render_modified_poster(
    source: bytes, modification: Modification, hints: int, seed: int
) -> bytes:
    with Image.open(io.BytesIO(source)) as original:
        poster = original.convert("RGB")
    hints = min(2, max(0, hints))
    if hints < 2:
        if modification == "black_white":
            poster = ImageEnhance.Color(poster).enhance(0.0 if hints == 0 else 0.5)
        elif modification == "mosaic":
            blocks = 12 if hints == 0 else 24
            small = (blocks, max(1, round(blocks * poster.height / poster.width)))
            poster = poster.resize(small, Image.Resampling.BOX).resize(
                poster.size, Image.Resampling.NEAREST
            )
        elif modification == "shuffled":
            # Resize to equal tiles to avoid seams or missing edge pixels.
            size = (max(3, poster.width // 3 * 3), max(3, poster.height // 3 * 3))
            poster = poster.resize(size)
            tile_w, tile_h = poster.width // 3, poster.height // 3
            positions = [(x * tile_w, y * tile_h) for y in range(3) for x in range(3)]
            shuffled = list(range(9))
            rng = random.Random(f"poster-tiles:{seed}")
            affected = list(range(9)) if hints == 0 else rng.sample(range(9), 4)
            rng.shuffle(affected)
            # A cyclic rotation of the shuffled positions has no fixed tiles.
            rotated = affected[1:] + affected[:1]
            for target, source_index in zip(affected, rotated):
                shuffled[target] = source_index
            result = Image.new("RGB", size)
            for target, source_index in enumerate(shuffled):
                x, y = positions[source_index]
                tile = poster.crop((x, y, x + tile_w, y + tile_h))
                result.paste(tile, positions[target])
            poster = result
    output = io.BytesIO()
    poster.save(output, format="JPEG", quality=90, optimize=True)
    return output.getvalue()
