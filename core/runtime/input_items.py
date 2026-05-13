"""Helpers for constructing SDK input items consistently."""

from agents import TResponseInputItem
from openai.types.responses import (
    EasyInputMessageParam,
    ResponseInputMessageContentListParam,
    ResponseInputTextParam,
)


def build_user_message_item(text: str) -> TResponseInputItem:
    text_item: ResponseInputTextParam = {"type": "input_text", "text": text}
    content: ResponseInputMessageContentListParam = [text_item]
    message: EasyInputMessageParam = {"type": "message", "role": "user", "content": content}
    return message
