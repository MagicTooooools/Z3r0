from http import HTTPStatus

from schema.common.responses import CommonResponse
from schema.sandbox.images import (
    CreateSandboxImageRequest,
    DeleteSandboxImageResponse,
    QuerySandboxImagesResponse,
    SandboxImageSchema,
)
from service.sandbox.images import (
    cancel_sandbox_image_pull,
    create_sandbox_image,
    delete_sandbox_image,
    query_sandbox_images,
    retry_sandbox_image,
)


async def create_sandbox_image_handler(request: CreateSandboxImageRequest) -> CommonResponse:
    sandbox_image = await create_sandbox_image(image_name=request.image_name)
    return CommonResponse(
        message="docker pull started",
        data=SandboxImageSchema.model_validate(sandbox_image),
    )


async def delete_sandbox_image_handler(id: int) -> CommonResponse:
    result = await delete_sandbox_image(id)
    if result.not_found:
        return CommonResponse(code=HTTPStatus.NOT_FOUND.value, message="sandbox image not found")
    if not result.deleted:
        return CommonResponse(code=HTTPStatus.BAD_REQUEST.value, message=result.message)
    return CommonResponse(data=DeleteSandboxImageResponse(id=id))


async def cancel_sandbox_image_pull_handler(id: int) -> CommonResponse:
    sandbox_image, canceled = await cancel_sandbox_image_pull(id)
    if sandbox_image is None:
        return CommonResponse(code=HTTPStatus.NOT_FOUND.value, message="sandbox image not found")
    if not canceled:
        return CommonResponse(
            code=HTTPStatus.BAD_REQUEST.value,
            message="only pulling sandbox images can be canceled",
            data=SandboxImageSchema.model_validate(sandbox_image),
        )
    return CommonResponse(
        message="docker pull canceled",
        data=SandboxImageSchema.model_validate(sandbox_image),
    )


async def retry_sandbox_image_handler(id: int) -> CommonResponse:
    sandbox_image, retried = await retry_sandbox_image(id)
    if sandbox_image is None:
        return CommonResponse(code=HTTPStatus.NOT_FOUND.value, message="sandbox image not found")
    if not retried:
        return CommonResponse(
            code=HTTPStatus.BAD_REQUEST.value,
            message="only failed or canceled sandbox images can be retried",
            data=SandboxImageSchema.model_validate(sandbox_image),
        )
    return CommonResponse(
        message="docker pull restarted",
        data=SandboxImageSchema.model_validate(sandbox_image),
    )


async def query_sandbox_images_handler(page: int, size: int, keyword: str) -> CommonResponse:
    sandbox_images = await query_sandbox_images(page=page, size=size, keyword=keyword)
    return CommonResponse(data=QuerySandboxImagesResponse(
        page=page,
        size=size,
        items=[SandboxImageSchema.model_validate(image) for image in sandbox_images],
    ))
