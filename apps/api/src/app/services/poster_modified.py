"""Deterministic poster effects. Anime popularity determines round difficulty."""

from __future__ import annotations

import io
import random
from typing import List, Literal, Tuple

from PIL import Image, ImageDraw, ImageFilter

Modification = Literal["spotlight", "mosaic", "shuffled"]
MODIFICATIONS: tuple[Modification, ...] = ("spotlight", "mosaic", "shuffled")

# Every stage stays modified: the plain poster (and its printed title) is only
# shown on the results screen.
MOSAIC_BLOCKS = (12, 18, 28)
SHUFFLE_GRID = (4, 6)  # columns x rows: near-square tiles on a 2:3 poster
SHUFFLE_SHARE = (1.0, 0.5, 0.25)  # share of tiles still out of place
# (windows, radius as a share of the poster width) per stage.
SPOTLIGHTS = ((4, 0.085), (6, 0.1), (9, 0.115))


def _mosaic(poster: Image.Image, hints: int) -> Image.Image:
    blocks = MOSAIC_BLOCKS[hints]
    small = (blocks, max(1, round(blocks * poster.height / poster.width)))
    return poster.resize(small, Image.Resampling.BOX).resize(
        poster.size, Image.Resampling.NEAREST
    )


def _shuffled(poster: Image.Image, hints: int, seed: int) -> Image.Image:
    cols, rows = SHUFFLE_GRID
    count = cols * rows
    # Resize to equal tiles to avoid seams or missing edge pixels.
    size = (max(cols, poster.width // cols * cols), max(rows, poster.height // rows * rows))
    poster = poster.resize(size)
    tile_w, tile_h = poster.width // cols, poster.height // rows
    positions = [(x * tile_w, y * tile_h) for y in range(rows) for x in range(cols)]
    rng = random.Random(f"poster-tiles:{seed}")
    # One fixed order, so a tile put back by a clue stays put on the next one.
    order = rng.sample(range(count), count)
    affected = order[: max(2, round(count * SHUFFLE_SHARE[hints]))]
    # A cyclic rotation of the shuffled positions has no fixed tiles.
    rotated = affected[1:] + affected[:1]
    placement = list(range(count))
    for target, source_index in zip(affected, rotated):
        placement[target] = source_index
    result = Image.new("RGB", size)
    for target, source_index in enumerate(placement):
        x, y = positions[source_index]
        result.paste(poster.crop((x, y, x + tile_w, y + tile_h)), positions[target])
    return result


def _spotlight_centres(width: int, height: int, seed: int, count: int) -> List[Tuple[float, float]]:
    rng = random.Random(f"poster-spotlight:{seed}")
    centres: List[Tuple[float, float]] = []
    min_gap = width * 0.26
    for _ in range(400):
        if len(centres) == count:
            break
        point = (rng.uniform(0.12, 0.88) * width, rng.uniform(0.1, 0.9) * height)
        if all((point[0] - x) ** 2 + (point[1] - y) ** 2 >= min_gap**2 for x, y in centres):
            centres.append(point)
    while len(centres) < count:  # tiny posters: accept overlaps
        centres.append((rng.uniform(0.12, 0.88) * width, rng.uniform(0.1, 0.9) * height))
    return centres


def _spotlight(poster: Image.Image, hints: int, seed: int) -> Image.Image:
    windows, share = SPOTLIGHTS[hints]
    radius = poster.width * share
    # The same centres every stage: a clue adds windows and widens them.
    centres = _spotlight_centres(poster.width, poster.height, seed, SPOTLIGHTS[-1][0])[:windows]
    mask = Image.new("L", poster.size, 0)
    draw = ImageDraw.Draw(mask)
    for x, y in centres:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius * 0.25))
    return Image.composite(poster, Image.new("RGB", poster.size, (8, 8, 12)), mask)


def render_modified_poster(
    source: bytes, modification: Modification, hints: int, seed: int
) -> bytes:
    with Image.open(io.BytesIO(source)) as original:
        poster = original.convert("RGB")
    hints = min(2, max(0, hints))
    if modification == "mosaic":
        poster = _mosaic(poster, hints)
    elif modification == "shuffled":
        poster = _shuffled(poster, hints, seed)
    elif modification == "spotlight":
        poster = _spotlight(poster, hints, seed)
    output = io.BytesIO()
    poster.save(output, format="JPEG", quality=90, optimize=True)
    return output.getvalue()
