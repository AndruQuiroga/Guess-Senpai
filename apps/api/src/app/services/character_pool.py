"""Helpers for allocating AniList character edges into round-based pools."""

from __future__ import annotations

from typing import List, Sequence, Set, Tuple

from .anilist import Media, MediaCharacterEdge, character_edges_for_tier

# Ordered fallback tiers to try for each requested difficulty.
_FALLBACK_BY_DIFFICULTY: dict[int, Tuple[int, ...]] = {
    1: (1, 2, 3),
    2: (2, 3, 1),
    3: (3, 2, 1),
}


def build_round_pools(
    media: Media,
    difficulties: Sequence[int],
    *,
    per_round: int = 4,
    max_candidates: int = 24,
) -> List[List[MediaCharacterEdge]] | None:
    """Return character edges grouped per round, honoring difficulty tiers.

    The function prefers unique characters across the entire game while ensuring
    each round contains distinct entries. It progressively relaxes difficulty
    requirements and uniqueness constraints to avoid dead-ends when AniList has
    sparse metadata for the selected show.
    """

    used_ids: Set[int] = set()
    allocations: List[List[MediaCharacterEdge]] = []

    for difficulty in difficulties:
        round_edges: List[MediaCharacterEdge] = []
        local_used: Set[int] = set()

        tiers = _FALLBACK_BY_DIFFICULTY.get(difficulty, (difficulty,))
        for tier in tiers:
            exclude_ids = used_ids.union(local_used)
            candidates = character_edges_for_tier(
                media,
                difficulty=tier,
                max_candidates=max_candidates,
                exclude_ids=exclude_ids,
            )
            for edge in candidates:
                character_id = edge.node.id
                if character_id in local_used:
                    continue
                round_edges.append(edge)
                local_used.add(character_id)
                if len(round_edges) >= per_round:
                    break
            if len(round_edges) >= per_round:
                break

        if len(round_edges) < per_round:
            exclude_ids = used_ids.union(local_used)
            candidates = character_edges_for_tier(
                media,
                difficulty=3,
                max_candidates=max_candidates,
                exclude_ids=exclude_ids,
            )
            for edge in candidates:
                character_id = edge.node.id
                if character_id in local_used:
                    continue
                if character_id in used_ids:
                    continue
                round_edges.append(edge)
                local_used.add(character_id)
                if len(round_edges) >= per_round:
                    break

        if len(round_edges) < per_round:
            # Final fallback: allow reusing characters from previous rounds,
            # but keep the round itself free of duplicates.
            candidates = character_edges_for_tier(
                media,
                difficulty=3,
                max_candidates=max_candidates,
                exclude_ids=local_used,
            )
            for edge in candidates:
                character_id = edge.node.id
                if character_id in local_used:
                    continue
                round_edges.append(edge)
                local_used.add(character_id)
                if len(round_edges) >= per_round:
                    break

        if len(round_edges) < per_round:
            return None

        used_ids.update(local_used)
        allocations.append(round_edges)

    return allocations
