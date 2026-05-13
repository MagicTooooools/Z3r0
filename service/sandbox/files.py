import asyncio
import base64
import copy
import os
import posixpath
import shlex
import shutil
import stat as stat_module
import tarfile
import tempfile
import time
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any, BinaryIO

import docker

from database import get_async_session
from model.sandbox.containers import SandboxContainer
from schema.sandbox.containers import (
    ContainerFileInfo,
    ContainerFileType,
    ContainerFileUploadItem,
    SandboxContainerStatus,
)


_ARCHIVE_CHUNK_SIZE = 1024 * 1024
_UPLOAD_ARCHIVE_MEMORY_LIMIT = 16 * 1024 * 1024
_DOWNLOAD_ARCHIVE_MEMORY_LIMIT = 64 * 1024 * 1024


@dataclass(frozen=True)
class ContainerUploadSource:
    filename: str
    stream: BinaryIO


@dataclass(frozen=True)
class ContainerDownloadStream:
    filename: str
    media_type: str
    chunks: Iterator[bytes]


def _exec_in_container_sync(container_hash: str, cmd: str) -> tuple[str, int]:
    client = docker.from_env()
    try:
        exit_code, output = client.containers.get(container_hash).exec_run(
            cmd=["/bin/sh", "-c", cmd],
            stdout=True,
            stderr=True,
            stdin=False,
            tty=False,
            demux=False,
        )
        text = output.decode(errors="replace") if isinstance(output, bytes) else str(output or "")
        code = exit_code if isinstance(exit_code, int) else 1
        return text, code
    finally:
        client.close()


def _normalize_container_path(path: str, *, default: str = "/") -> str:
    raw = (path or default).strip()
    if "\x00" in raw:
        raise ValueError("path contains invalid characters")
    if not raw.startswith("/"):
        raw = f"/{raw}"
    normalized = posixpath.normpath(raw)
    return "/" if normalized in {"", "."} else normalized


def _join_container_path(parent: str, name: str) -> str:
    base = _normalize_container_path(parent)
    return f"/{name}" if base == "/" else f"{base}/{name}"


def _safe_upload_name(filename: str) -> str:
    name = os.path.basename((filename or "").replace("\\", "/")).strip()
    if name in {"", ".", ".."} or "/" in name or "\x00" in name:
        raise ValueError("invalid upload filename")
    return name


def _safe_download_name(name: str, *, fallback: str = "download") -> str:
    cleaned = os.path.basename((name or fallback).replace("\\", "/")).strip()
    if cleaned in {"", ".", ".."} or "\x00" in cleaned:
        return fallback
    return cleaned


def _download_base_name(path: str, stat: dict[str, Any] | None = None) -> str:
    stat_name = stat.get("name") if isinstance(stat, dict) else None
    raw_name = str(stat_name or posixpath.basename(path.rstrip("/")) or "root")
    return _safe_download_name(raw_name, fallback="root")


def _is_directory_stat(stat: dict[str, Any] | None) -> bool:
    if not isinstance(stat, dict):
        return False
    try:
        mode = int(stat.get("mode", 0))
    except (TypeError, ValueError):
        return False
    return stat_module.S_ISDIR(mode)


def _copy_fileobj_count(source: BinaryIO, destination: BinaryIO) -> int:
    total = 0
    while True:
        chunk = source.read(_ARCHIVE_CHUNK_SIZE)
        if not chunk:
            return total
        destination.write(chunk)
        total += len(chunk)


def _iter_file_chunks(fileobj: BinaryIO) -> Iterator[bytes]:
    try:
        fileobj.seek(0)
        while True:
            chunk = fileobj.read(_ARCHIVE_CHUNK_SIZE)
            if not chunk:
                return
            yield chunk
    finally:
        fileobj.close()


def _iter_docker_chunks(client: docker.DockerClient, chunks: Iterator[bytes]) -> Iterator[bytes]:
    try:
        yield from chunks
    finally:
        client.close()


def _spool_chunks(chunks: Iterator[bytes], *, max_size: int) -> BinaryIO:
    archive = tempfile.SpooledTemporaryFile(max_size=max_size, mode="w+b")
    try:
        for chunk in chunks:
            archive.write(chunk)
        archive.seek(0)
        return archive
    except Exception:
        archive.close()
        raise


def _container_directory_exists(container_hash: str, path: str) -> bool:
    _, exit_code = _exec_in_container_sync(container_hash, f"test -d {shlex.quote(path)}")
    return exit_code == 0


def _container_path_exists(container_hash: str, path: str) -> bool:
    _, exit_code = _exec_in_container_sync(container_hash, f"test -e {shlex.quote(path)}")
    return exit_code == 0


def _upload_container_files_sync(
    container_hash: str,
    path: str,
    sources: list[ContainerUploadSource],
    overwrite: bool,
) -> list[ContainerFileUploadItem]:
    destination = _normalize_container_path(path)
    if not sources:
        raise ValueError("no files uploaded")
    if not _container_directory_exists(container_hash, destination):
        raise FileNotFoundError("destination directory not found")

    archive = tempfile.SpooledTemporaryFile(max_size=_UPLOAD_ARCHIVE_MEMORY_LIMIT, mode="w+b")
    uploaded: list[ContainerFileUploadItem] = []
    seen_names: set[str] = set()
    try:
        with tarfile.open(fileobj=archive, mode="w") as tar:
            for source in sources:
                name = _safe_upload_name(source.filename)
                if name in seen_names:
                    raise ValueError(f"duplicate upload filename: {name}")
                seen_names.add(name)

                target_path = _join_container_path(destination, name)
                if not overwrite and _container_path_exists(container_hash, target_path):
                    raise FileExistsError(f"file already exists: {target_path}")

                try:
                    source.stream.seek(0)
                except (AttributeError, OSError):
                    pass

                payload = tempfile.SpooledTemporaryFile(max_size=_UPLOAD_ARCHIVE_MEMORY_LIMIT, mode="w+b")
                try:
                    size = _copy_fileobj_count(source.stream, payload)
                    payload.seek(0)

                    info = tarfile.TarInfo(name=name)
                    info.size = size
                    info.mode = 0o644
                    info.mtime = int(time.time())
                    tar.addfile(info, payload)
                finally:
                    payload.close()

                uploaded.append(ContainerFileUploadItem(name=name, path=target_path, size=size))

        archive.seek(0)
        client = docker.from_env()
        try:
            ok = client.containers.get(container_hash).put_archive(destination, archive)
        finally:
            client.close()
        if not ok:
            raise RuntimeError("failed to upload files")
        return uploaded
    finally:
        archive.close()


def _extract_single_file_archive(path: str, stat: dict[str, Any] | None, archive: BinaryIO) -> ContainerDownloadStream:
    archive.seek(0)
    output = tempfile.SpooledTemporaryFile(max_size=_DOWNLOAD_ARCHIVE_MEMORY_LIMIT, mode="w+b")
    try:
        with tarfile.open(fileobj=archive, mode="r:*") as tar:
            for member in tar.getmembers():
                if not member.isfile():
                    continue
                source = tar.extractfile(member)
                if source is None:
                    continue
                with source:
                    shutil.copyfileobj(source, output, length=_ARCHIVE_CHUNK_SIZE)
                filename = _download_base_name(path, stat)
                output.seek(0)
                return ContainerDownloadStream(
                    filename=filename,
                    media_type="application/octet-stream",
                    chunks=_iter_file_chunks(output),
                )
        raise RuntimeError("download archive did not contain a file")
    except Exception:
        output.close()
        raise


def _download_single_path_sync(container_hash: str, path: str) -> ContainerDownloadStream:
    container_path = _normalize_container_path(path)
    client = docker.from_env()
    try:
        chunks, stat = client.containers.get(container_hash).get_archive(
            container_path,
            chunk_size=_ARCHIVE_CHUNK_SIZE,
        )
    except docker.errors.NotFound as exc:
        client.close()
        raise FileNotFoundError("path not found") from exc
    except Exception:
        client.close()
        raise

    if _is_directory_stat(stat):
        return ContainerDownloadStream(
            filename=f"{_download_base_name(container_path, stat)}.tar",
            media_type="application/x-tar",
            chunks=_iter_docker_chunks(client, chunks),
        )

    try:
        archive = _spool_chunks(chunks, max_size=_DOWNLOAD_ARCHIVE_MEMORY_LIMIT)
    finally:
        client.close()

    try:
        return _extract_single_file_archive(container_path, stat, archive)
    finally:
        archive.close()

def _safe_tar_member_name(name: str) -> str:
    cleaned = posixpath.normpath(str(name or "").replace("\\", "/")).lstrip("/")
    if cleaned in {"", ".", ".."} or cleaned.startswith("../"):
        raise ValueError("unsafe tar member name")
    return cleaned

def _unique_tar_root(name: str, used: set[str]) -> str:
    base = _safe_download_name(name, fallback="item")
    candidate = base
    index = 2
    while candidate in used:
        candidate = f"{base}-{index}"
        index += 1
    used.add(candidate)
    return candidate

def _remap_tar_member_name(member_name: str, source_root: str, target_root: str) -> str:
    safe_name = _safe_tar_member_name(member_name)
    if safe_name == source_root:
        return target_root
    prefix = f"{source_root}/"
    if safe_name.startswith(prefix):
        return f"{target_root}/{safe_name[len(prefix):]}"
    return f"{target_root}/{safe_name}"

def _copy_archive_into_tar(target_tar: tarfile.TarFile, archive: BinaryIO, target_root: str) -> None:
    archive.seek(0)
    with tarfile.open(fileobj=archive, mode="r:*") as source_tar:
        members = source_tar.getmembers()
        if not members:
            return
        source_root = _safe_tar_member_name(members[0].name).split("/", 1)[0]
        for member in members:
            copied = copy.copy(member)
            copied.name = _remap_tar_member_name(member.name, source_root, target_root)
            if member.isfile():
                source = source_tar.extractfile(member)
                if source is None:
                    continue
                with source:
                    target_tar.addfile(copied, source)
            else:
                target_tar.addfile(copied)

def _download_multiple_paths_sync(container_hash: str, paths: list[str]) -> ContainerDownloadStream:
    normalized_paths = [_normalize_container_path(path) for path in paths]
    if not normalized_paths:
        raise ValueError("download path is required")

    output = tempfile.SpooledTemporaryFile(max_size=_DOWNLOAD_ARCHIVE_MEMORY_LIMIT, mode="w+b")
    client = docker.from_env()
    try:
        container = client.containers.get(container_hash)
        used_roots: set[str] = set()
        with tarfile.open(fileobj=output, mode="w") as target_tar:
            for container_path in normalized_paths:
                try:
                    chunks, stat = container.get_archive(container_path, chunk_size=_ARCHIVE_CHUNK_SIZE)
                except docker.errors.NotFound as exc:
                    raise FileNotFoundError(f"path not found: {container_path}") from exc
                archive = _spool_chunks(chunks, max_size=_DOWNLOAD_ARCHIVE_MEMORY_LIMIT)
                try:
                    target_root = _unique_tar_root(_download_base_name(container_path, stat), used_roots)
                    _copy_archive_into_tar(target_tar, archive, target_root)
                finally:
                    archive.close()
    except Exception:
        output.close()
        raise
    finally:
        client.close()

    output.seek(0)
    return ContainerDownloadStream(
        filename="container-files.tar",
        media_type="application/x-tar",
        chunks=_iter_file_chunks(output),
    )

def _parse_find_output(raw: str, base_path: str) -> list[ContainerFileInfo]:
    files: list[ContainerFileInfo] = []
    for line in raw.strip().split("\n"):
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) != 7:
            continue
        name, type_char, size_str, mtime_str, owner, group, perms = parts
        type_map = {"f": ContainerFileType.FILE, "d": ContainerFileType.DIRECTORY, "l": ContainerFileType.SYMLINK}
        file_type = type_map.get(type_char)
        if file_type is None:
            continue
        try:
            size = int(size_str)
        except ValueError:
            size = 0
        try:
            modified_at = int(float(mtime_str))
        except ValueError:
            modified_at = 0
        base = base_path.rstrip("/")
        files.append(ContainerFileInfo(
            name=name,
            type=file_type,
            size=size,
            modified_at=modified_at,
            owner=owner,
            group=group,
            permissions=perms,
            path=f"{base}/{name}",
        ))
    return files

async def list_container_files(container_hash: str, path: str) -> list[ContainerFileInfo]:
    safe_path = shlex.quote(path)
    cmd = f"find {safe_path} -maxdepth 1 -mindepth 1 -printf '%f\\t%y\\t%s\\t%T@\\t%u\\t%g\\t%#m\\n' 2>/dev/null"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    if exit_code != 0:
        raise RuntimeError(f"failed to list container files (exit code {exit_code}): {stdout.strip() or '(empty output)'}")
    return _parse_find_output(stdout, path)

async def get_container_file_info(container_hash: str, path: str) -> ContainerFileInfo | None:
    parent = path.rsplit("/", 1)[0] or "/"
    name = path.rsplit("/", 1)[-1] or path
    safe_parent = shlex.quote(parent)
    safe_name = shlex.quote(name)
    cmd = f"find {safe_parent} -maxdepth 1 -name {safe_name} -printf '%f\\t%y\\t%s\\t%T@\\t%u\\t%g\\t%#m\\n' 2>/dev/null"
    stdout, _exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    files = _parse_find_output(stdout, parent)
    return files[0] if files else None

async def read_container_file(container_hash: str, path: str, max_bytes: int = 1_048_576, *, base64_mode: bool = False) -> str:
    safe_path = shlex.quote(path)
    if base64_mode:
        cmd = f"base64 {safe_path} 2>/dev/null | head -c {max_bytes * 2}"
    else:
        cmd = f"head -c {max_bytes} {safe_path} 2>/dev/null"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    if exit_code != 0:
        raise RuntimeError(f"failed to read container file: {stdout.strip()}")
    return stdout

async def upload_container_files(
    container_hash: str,
    path: str,
    sources: list[ContainerUploadSource],
    overwrite: bool,
) -> list[ContainerFileUploadItem]:
    return await asyncio.to_thread(_upload_container_files_sync, container_hash, path, sources, overwrite)

async def download_container_paths(container_hash: str, paths: list[str]) -> ContainerDownloadStream:
    if len(paths) == 1:
        return await asyncio.to_thread(_download_single_path_sync, container_hash, paths[0])
    return await asyncio.to_thread(_download_multiple_paths_sync, container_hash, paths)

async def write_container_file(container_hash: str, path: str, content: str) -> bool:
    encoded = base64.b64encode(content.encode()).decode()
    safe_path = shlex.quote(path)
    cmd = f"echo {shlex.quote(encoded)} | base64 -d > {safe_path}"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    return exit_code == 0

async def copy_container_files(container_hash: str, sources: list[str], destination: str) -> bool:
    quoted_sources = " ".join(shlex.quote(src) for src in sources)
    safe_dest = shlex.quote(destination)
    cmd = f"cp -r {quoted_sources} {safe_dest}"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    return exit_code == 0

async def move_container_files(container_hash: str, sources: list[str], destination: str) -> bool:
    quoted_sources = " ".join(shlex.quote(src) for src in sources)
    safe_dest = shlex.quote(destination)
    cmd = f"mv {quoted_sources} {safe_dest}"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    return exit_code == 0

async def delete_container_files(container_hash: str, paths: list[str]) -> bool:
    quoted_paths = " ".join(shlex.quote(p) for p in paths)
    cmd = f"rm -rf {quoted_paths}"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    return exit_code == 0

async def create_container_directory(container_hash: str, path: str) -> bool:
    safe_path = shlex.quote(path)
    cmd = f"mkdir -p {safe_path}"
    stdout, exit_code = await asyncio.to_thread(_exec_in_container_sync, container_hash, cmd)
    return exit_code == 0

async def resolve_file_container(id: int) -> tuple[str, SandboxContainerStatus] | None:
    async with get_async_session() as session:
        sandbox_container = await session.get(SandboxContainer, id)
        if sandbox_container is None:
            return None
        return sandbox_container.container_hash, sandbox_container.status
