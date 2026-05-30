"""Task-resumption prompts for completed background work."""

from schema.agent.notifications import AgentNotificationSnapshot


def notification_prompt(notification: AgentNotificationSnapshot) -> str:
    if notification.kind == "sandbox_async_job_finished":
        return _sandbox_async_job_prompt(notification)
    return _subagent_finished_prompt(notification)


_RESUMPTION_HEADER = (
    "# Task Resumption Context\n\n"
    "This is task context, not a new user request. "
    "Continue from the completed background work without mentioning how this context was delivered."
)


def _subagent_finished_prompt(notification: AgentNotificationSnapshot) -> str:
    payload = notification.payload
    status = str(payload.get("status") or "unknown")
    agent_name = str(payload.get("agent_name") or payload.get("agent_code") or "subagent")
    run_id = str(payload.get("run_id") or notification.run_id)
    result = str(payload.get("result") or "").strip()
    error = str(payload.get("error") or "").strip()

    event_lines = [
        "- kind: delegated_task_completed",
        f"- run_id: {run_id}",
        f"- subagent: {agent_name}",
        f"- status: {status}",
    ]

    sections = [
        _RESUMPTION_HEADER,
        "## Event\n\n" + "\n".join(event_lines),
    ]

    body = result if status == "completed" else error
    if body:
        sections.append(f"## Result\n\n{body}")

    sections.append(
        "## Next Step\n\n"
        "Integrate this result into the current task. "
        "Report to the user only when there is a useful conclusion, coordination update, or next action."
    )
    return "\n\n".join(sections)


def _sandbox_async_job_prompt(notification: AgentNotificationSnapshot) -> str:
    payload = notification.payload
    status = str(payload.get("status") or "unknown")
    run_id = notification.run_id
    output_file = str(payload.get("output_file") or "")
    output_lines = int(payload.get("output_lines") or 0)
    output_bytes = int(payload.get("output_bytes") or 0)
    exit_code = payload.get("exit_code")
    error = str(payload.get("error") or "").strip()

    event_lines = [
        "- kind: async_command_completed",
        f"- run_id: {run_id}",
        f"- status: {status}",
    ]
    if exit_code is not None:
        event_lines.append(f"- exit_code: {exit_code}")
    if output_file:
        event_lines.append(f"- output_file: {output_file}")
        event_lines.append(f"- output_lines: {output_lines}")
        event_lines.append(f"- output_bytes: {output_bytes}")
    if error:
        event_lines.append(f"- error: {error}")

    sections = [
        _RESUMPTION_HEADER,
        "## Event\n\n" + "\n".join(event_lines),
        "## Next Step\n\n"
        "The async command has reached a terminal state. "
        "If `output_lines` is greater than 0 and the result matters, read the output with "
        "`read_sandbox_command_output` using `output_file` and `start_line: 1`. "
        "Then continue the task or report the final result.",
    ]
    return "\n\n".join(sections)
