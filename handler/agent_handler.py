from config import get_config
from core.agents import DEFAULT_AGENT_CODE
from core.runtime import get_agent_registry
from schema.agent_session_schema import AgentInfoSchema, ListAgentsResponse
from schema.response_schema import CommonResponse


async def list_agents_handler() -> CommonResponse:
    cfg = get_config()
    items = [
        AgentInfoSchema(
            code=code,
            name=cfg.agents[code].name,
            description=cfg.agents[code].description,
        )
        for code in get_agent_registry().codes()
    ]
    return CommonResponse(data=ListAgentsResponse(
        items=items,
        default_code=DEFAULT_AGENT_CODE,
    ))
