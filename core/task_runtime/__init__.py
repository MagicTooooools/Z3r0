"""Interrupt-driven task execution runtime for agent turns."""

from core.task_runtime.executor import run_until_idle
from core.task_runtime.interrupt import InterruptSignal, iter_interruptible_events

__all__ = [
    "InterruptSignal",
    "iter_interruptible_events",
    "run_until_idle",
]
