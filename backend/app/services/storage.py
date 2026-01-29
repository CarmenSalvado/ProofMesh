from __future__ import annotations

import anyio
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import get_settings

settings = get_settings()


def _make_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(s3={"addressing_style": "path"}),
        verify=settings.s3_secure,
    )


_s3_client = _make_client()


async def ensure_bucket() -> None:
    def _ensure():
        try:
            _s3_client.head_bucket(Bucket=settings.s3_bucket)
        except ClientError:
            _s3_client.create_bucket(Bucket=settings.s3_bucket)

    await anyio.to_thread.run_sync(_ensure)


async def list_objects(prefix: str) -> list[dict]:
    def _list():
        paginator = _s3_client.get_paginator("list_objects_v2")
        results: list[dict] = []
        for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
            results.extend(page.get("Contents", []))
        return results

    return await anyio.to_thread.run_sync(_list)


async def get_object_bytes(key: str) -> bytes | None:
    def _get():
        try:
            response = _s3_client.get_object(Bucket=settings.s3_bucket, Key=key)
            return response["Body"].read()
        except ClientError:
            return None

    return await anyio.to_thread.run_sync(_get)


async def head_object(key: str) -> dict | None:
    def _head():
        try:
            return _s3_client.head_object(Bucket=settings.s3_bucket, Key=key)
        except ClientError:
            return None

    return await anyio.to_thread.run_sync(_head)


async def put_object(key: str, data: bytes, content_type: str | None = None) -> None:
    def _put():
        extra = {"ContentType": content_type} if content_type else {}
        _s3_client.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, **extra)

    await anyio.to_thread.run_sync(_put)


async def delete_object(key: str) -> None:
    def _delete():
        _s3_client.delete_object(Bucket=settings.s3_bucket, Key=key)

    await anyio.to_thread.run_sync(_delete)


async def copy_object(source_key: str, dest_key: str) -> None:
    def _copy():
        _s3_client.copy_object(
            Bucket=settings.s3_bucket,
            CopySource={"Bucket": settings.s3_bucket, "Key": source_key},
            Key=dest_key,
        )

    await anyio.to_thread.run_sync(_copy)


async def delete_prefix(prefix: str) -> int:
    objects = await list_objects(prefix)
    keys = [obj.get("Key") for obj in objects if obj.get("Key")]
    count = 0
    for key in keys:
        await delete_object(key)
        count += 1
    return count
