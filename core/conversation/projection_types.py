"""Shared data structures for projected model context."""

from dataclasses import dataclass

from agents.items import TResponseInputItem


@dataclass(frozen=True, slots=True)
class ProjectionCompaction:
    id: int
    end_message_id: int
    summary_item: TResponseInputItem


@dataclass(frozen=True, slots=True)
class ProjectedItem:
    item: TResponseInputItem
    source_message_ids: tuple[int, ...] = ()
    token_estimate: int = 0


@dataclass(frozen=True, slots=True)
class ContextProjection:
    projected_items: list[ProjectedItem]

    @property
    def items(self) -> list[TResponseInputItem]:
        return [projected.item for projected in self.projected_items]
