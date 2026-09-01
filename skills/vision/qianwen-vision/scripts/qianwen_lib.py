"""Shared cloud AI client infrastructure for QianWen-AI/qianwen-ai skills.

Provider-based architecture: generic HTTP, env, and file-handling infrastructure
with pluggable AI provider implementations.  DashScope is the built-in default;
additional providers can be registered via ``register_provider()``.

Modules are organised by responsibility:
  - Environment & credentials: load_dotenv, find_repo_root, require_api_key
  - Provider abstraction: AIProvider, DashScopeProvider, register_provider
  - Region & endpoints: compat_base_url, native_base_url
  - HTTP client: http_request, http_post, stream_sse
  - File I/O: upload_local_file, resolve_file, download_file
  - Request/response utilities: load_request, save_result, extract_text
  - Update-check signal: run_update_signal

Stdlib only -- no pip install required.
"""
from __future__ import annotations

import sys

if sys.version_info < (3, 9):
    print(
        f"Error: Python 3.9+ required (found {sys.version}). "
        "Install: https://www.python.org/downloads/",
        file=sys.stderr,
    )
    sys.exit(1)

import base64
import inspect
import json
import mimetypes
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Iterator


# ---------------------------------------------------------------------------
# Section 1: Generic environment & credential loading
# ---------------------------------------------------------------------------

def find_repo_root(start: Path) -> Path | None:
    """Walk up from *start* looking for a repository root marker.

    Returns the first directory that contains ``.git`` or a ``skills/``
    subdirectory, or ``None`` if no marker is found.
    """
    for parent in [start] + list(start.parents):
        if (parent / ".git").exists() or (parent / "skills").is_dir():
            return parent
    return None


def load_dotenv(path: Path) -> None:
    """Parse a simple ``.env`` file and inject into ``os.environ``.

    Existing environment variables are **not** overwritten.
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_env(script_file: str | Path | None = None) -> None:
    """Load ``.env`` files with proper priority: current dir > repo root.

    Parameters
    ----------
    script_file : str or Path, optional
        ``__file__`` of the calling script, used to locate the repo root.
    """
    load_dotenv(Path.cwd() / ".env")
    origin = Path(script_file).resolve() if script_file else None
    if origin:
        repo = find_repo_root(origin)
        if repo:
            load_dotenv(repo / ".env")


def mask_key(key: str) -> str:
    """Return a masked version of an API key for safe logging.

    Shows the first 4 and last 4 characters with ``...`` in between.
    Keys shorter than 9 characters are fully masked.
    """
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


# ---------------------------------------------------------------------------
# Section 2: AIProvider base class
# ---------------------------------------------------------------------------

class AIProvider:
    """Base interface for an AI service provider.

    Subclasses must implement all methods.  The built-in ``DashScopeProvider``
    is registered by default; additional providers can be added via
    ``register_provider()`` and selected at runtime with the ``QWEN_PROVIDER``
    environment variable.
    """

    name: str = ""

    # --- Authentication ---

    def get_api_key_env_name(self) -> str:
        """Return the environment variable name for this provider's API key."""
        raise NotImplementedError

    def get_console_url(self) -> str:
        """Return the URL where users can obtain an API key."""
        raise NotImplementedError

    def validate_api_key(
            self,
            key: str,
            *,
            domain: str = "",
    ) -> str:
        """Validate *key* and return it, or ``sys.exit`` with guidance.

        Provider-specific checks (e.g. prefix validation) go here.
        """
        raise NotImplementedError

    # --- Endpoints ---

    def compat_base_url(self) -> str:
        """Return the OpenAI-compatible API base URL."""
        raise NotImplementedError

    def native_base_url(self) -> str:
        """Return the provider's native API base URL."""
        raise NotImplementedError

    # --- HTTP headers ---

    def make_headers(
            self,
            api_key: str,
            payload: Any = None,
    ) -> dict[str, str]:
        """Build HTTP request headers.

        *payload* is provided so that providers can inject conditional
        headers (e.g. DashScope's ``X-DashScope-OssResourceResolve``).
        """
        raise NotImplementedError

    # --- Managed file URLs ---

    def has_managed_url(self, obj: Any) -> bool:
        """Check whether *obj* contains any provider-managed file URLs."""
        raise NotImplementedError

    def managed_url_schemes(self) -> tuple[str, ...]:
        """Return URL scheme prefixes for provider-managed storage.

        Used by ``resolve_file`` to detect URLs that should pass through
        without modification (e.g. ``("oss://",)`` for DashScope).
        """
        raise NotImplementedError

    # --- File upload ---

    def upload_file(self, api_key: str, model: str, fp: Path) -> str:
        """Upload a local file to provider temp storage.

        Returns a provider-managed URL string.
        """
        raise NotImplementedError

    # --- Async task polling ---

    def task_poll_url(self, task_id: str) -> str:
        """Build the URL to poll an async task's status."""
        raise NotImplementedError

    def extract_task_status(self, result: dict[str, Any]) -> str:
        """Extract the task status string from a poll response."""
        raise NotImplementedError

    def terminal_statuses(self) -> frozenset[str]:
        """Return the set of terminal task statuses."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Section 3: DashScopeProvider implementation
# ---------------------------------------------------------------------------

class DashScopeProvider(AIProvider):
    """Built-in provider for DashScope."""

    name = "dashscope"

    _CONSOLE_URL = "https://platform.qianwenai.com/home/api-keys"

    _COMPATIBLE_BASE: dict[str, str] = {
        "cn-beijing": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    }

    _NATIVE_BASE: dict[str, str] = {
        "cn-beijing": "https://dashscope.aliyuncs.com/api/v1",
    }

    _TOKEN_PLAN_COMPATIBLE_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
    _TOKEN_PLAN_NATIVE_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1"

    # --- Authentication ---

    def get_api_key_env_name(self) -> str:
        return "DASHSCOPE_API_KEY"

    def get_console_url(self) -> str:
        return self._CONSOLE_URL

    def validate_api_key(
            self,
            key: str,
            *,
            domain: str = "",
    ) -> str:
        return key

    # --- Endpoints ---

    def compat_base_url(self) -> str:
        url = os.getenv("QWEN_BASE_URL")
        region = os.getenv("QWEN_REGION", "cn-beijing").lower()
        if region == "none":
            # When QWEN_REGION=none, skip URL assembly and return the user-configured base URL as-is.
            if not url:
                raise RuntimeError(
                    "QWEN_BASE_URL must be set when QWEN_REGION=none."
                )
            return url.rstrip("/")
        if url:
            return url.rstrip("/")
        if is_token_plan_key():
            return self._TOKEN_PLAN_COMPATIBLE_BASE
        return self._COMPATIBLE_BASE.get(region, self._COMPATIBLE_BASE["cn-beijing"])

    def native_base_url(self) -> str:
        custom = os.getenv("QWEN_BASE_URL")
        region = os.getenv("QWEN_REGION", "cn-beijing").lower()
        if region == "none":
            # When QWEN_REGION=none, skip URL assembly and return the user-configured base URL as-is.
            if not custom:
                raise RuntimeError(
                    "QWEN_BASE_URL must be set when QWEN_REGION=none."
                )
            return custom.rstrip("/")
        if custom:
            parsed = urllib.parse.urlparse(custom.rstrip("/"))
            return f"{parsed.scheme}://{parsed.netloc}/api/v1"
        if is_token_plan_key():
            return self._TOKEN_PLAN_NATIVE_BASE
        return self._NATIVE_BASE.get(region, self._NATIVE_BASE["cn-beijing"])

    # --- HTTP headers ---

    def make_headers(
            self,
            api_key: str,
            payload: Any = None,
    ) -> dict[str, str]:
        hdrs: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "qianwenai-skill",
        }
        if payload and self.has_managed_url(payload):
            hdrs["X-DashScope-OssResourceResolve"] = "enable"
        source_cfg = build_source_config()
        if source_cfg:
            hdrs["X-DashScope-Source-Config"] = source_cfg
        return hdrs

    # --- Managed file URLs ---

    def has_managed_url(self, obj: Any) -> bool:
        if isinstance(obj, str):
            return obj.startswith("oss://")
        if isinstance(obj, dict):
            return any(self.has_managed_url(v) for v in obj.values())
        if isinstance(obj, (list, tuple)):
            return any(self.has_managed_url(v) for v in obj)
        return False

    def managed_url_schemes(self) -> tuple[str, ...]:
        return ("oss://",)

    # --- File upload (OSS) ---

    def upload_file(self, api_key: str, model: str, fp: Path) -> str:
        """Upload a local file and return a URL for API consumption.

        When ``QWEN_TMP_OSS_BUCKET`` is set, files go to the user's own
        OSS bucket and a presigned ``https://`` URL is returned.
        Otherwise, files go to DashScope temp storage (48 h TTL) and an
        ``oss://`` URL is returned.
        """
        if is_token_plan_key(api_key):
            print(
                "Error: Token Plan does not support local file upload.\n"
                "Provide the reference image/video as an accessible URL "
                "(https:// or oss://) instead.\n"
                "Read more: https://platform.qianwenai.com/docs/token-plan/overview",
                file=sys.stderr,
            )
            sys.exit(1)
        if os.getenv("QWEN_TMP_OSS_BUCKET"):
            return self._upload_to_user_oss(fp)
        policy = self._get_upload_policy(api_key, model)
        key = f"{policy['upload_dir']}/{fp.name}"
        mime = mimetypes.guess_type(fp.name)[0] or "application/octet-stream"
        fields = {
            "OSSAccessKeyId": policy["oss_access_key_id"],
            "Signature": policy["signature"],
            "policy": policy["policy"],
            "x-oss-object-acl": policy["x_oss_object_acl"],
            "x-oss-forbid-overwrite": policy["x_oss_forbid_overwrite"],
            "key": key,
            "success_action_status": "200",
        }
        body, ct = self._build_multipart(fields, fp.name, fp.read_bytes(), mime)
        req = urllib.request.Request(
            policy["upload_host"],
            data=body,
            method="POST",
            headers={"Content-Type": ct},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"OSS upload HTTP {resp.status}")
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                detail = exc.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            raise RuntimeError(
                f"OSS upload failed (HTTP {exc.code}): {detail[:300]}"
            ) from exc
        return f"oss://{key}"

    def _upload_to_user_oss(self, fp: Path) -> str:
        """Upload a file to the user's own OSS bucket via oss2.

        Returns a presigned ``https://`` URL.  Requires
        ``QWEN_TMP_OSS_BUCKET`` and ``QWEN_TMP_OSS_REGION``.
        Credentials are resolved from ``QWEN_TMP_OSS_AK_ID`` /
        ``QWEN_TMP_OSS_AK_SECRET`` first, falling back to
        ``OSS_ACCESS_KEY_ID`` / ``OSS_ACCESS_KEY_SECRET``
        environment variables.
        """
        try:
            import oss2  # type: ignore[import-untyped]
        except ImportError:
            print(
                "Error: oss2 is required for custom OSS upload.\n"
                "Install: pip3 install oss2\n"
                "Docs: https://help.aliyun.com/zh/oss/developer-reference/simple-upload-2",
                file=sys.stderr,
            )
            sys.exit(1)

        bucket_name = os.environ["QWEN_TMP_OSS_BUCKET"]
        region = os.getenv("QWEN_TMP_OSS_REGION", "")
        if not region:
            print(
                "Error: QWEN_TMP_OSS_REGION is required when "
                "QWEN_TMP_OSS_BUCKET is set.",
                file=sys.stderr,
            )
            sys.exit(1)

        ak_id = os.getenv("QWEN_TMP_OSS_AK_ID", "") or os.getenv("OSS_ACCESS_KEY_ID", "")
        ak_secret = os.getenv("QWEN_TMP_OSS_AK_SECRET", "") or os.getenv("OSS_ACCESS_KEY_SECRET", "")
        if not ak_id or not ak_secret:
            print(
                "Error: OSS credentials not found. Set QWEN_TMP_OSS_AK_ID/SECRET "
                "or OSS_ACCESS_KEY_ID/SECRET.",
                file=sys.stderr,
            )
            sys.exit(1)

        endpoint = os.getenv("QWEN_TMP_OSS_ENDPOINT", f"https://oss-{region}.aliyuncs.com")
        auth = oss2.Auth(ak_id, ak_secret)
        bucket_obj = oss2.Bucket(auth, endpoint, bucket_name)

        prefix = os.getenv("QWEN_TMP_OSS_PREFIX", "qianwen-skill-uploads").strip("/")
        from datetime import datetime as _dt
        date_dir = _dt.now().strftime("%Y%m%d")
        key = f"{prefix}/{date_dir}/{uuid.uuid4().hex[:8]}_{fp.name}"

        mime = mimetypes.guess_type(fp.name)[0] or "application/octet-stream"
        try:
            bucket_obj.put_object(key, fp.read_bytes(), headers={"Content-Type": mime})
            expires_s = int(os.getenv("QWEN_TMP_OSS_URL_EXPIRES", "86400"))
            url = bucket_obj.sign_url("GET", key, expires_s)
            return url
        except Exception as exc:
            msg = str(exc)
            if ak_id:
                msg = msg.replace(ak_id, mask_key(ak_id))
            if ak_secret:
                msg = msg.replace(ak_secret, mask_key(ak_secret))
            raise RuntimeError(f"Custom OSS upload failed: {msg}") from exc

    def _get_upload_policy(self, api_key: str, model: str) -> dict[str, Any]:
        url = (
            f"{self.native_base_url()}/uploads?"
            f"{urllib.parse.urlencode({'action': 'getPolicy', 'model': model})}"
        )
        req = urllib.request.Request(
            url,
            method="GET",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        data = body.get("data")
        if not data:
            raise RuntimeError(
                f"Upload policy error: {json.dumps(body, ensure_ascii=False)[:300]}"
            )
        return data

    @staticmethod
    def _build_multipart(
            fields: dict[str, str],
            fname: str,
            fbytes: bytes,
            fmime: str,
    ) -> tuple[bytes, str]:
        boundary = uuid.uuid4().hex
        parts: list[bytes] = []
        for k, v in fields.items():
            parts.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
            )
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{fname}"\r\n'
            f"Content-Type: {fmime}\r\n\r\n".encode()
        )
        parts.append(fbytes)
        parts.append(f"\r\n--{boundary}--\r\n".encode())
        return b"".join(parts), f"multipart/form-data; boundary={boundary}"

    # --- Async task polling ---

    def task_poll_url(self, task_id: str) -> str:
        return f"{self.native_base_url()}/tasks/{task_id}"

    def extract_task_status(self, result: dict[str, Any]) -> str:
        return result.get("output", {}).get("task_status", "")

    def terminal_statuses(self) -> frozenset[str]:
        return frozenset({"SUCCEEDED", "FAILED", "CANCELED"})


# ---------------------------------------------------------------------------
# Section 4: Provider registry & resolution
# ---------------------------------------------------------------------------

_PROVIDERS: dict[str, type[AIProvider]] = {}
_cached_provider: AIProvider | None = None


def register_provider(name: str, cls: type[AIProvider]) -> None:
    """Register an AI provider class under *name*.

    Example::

        class MyProvider(AIProvider):
            name = "my_provider"
            ...

        register_provider("my_provider", MyProvider)
    """
    _PROVIDERS[name.lower()] = cls


def get_provider() -> AIProvider:
    """Return the active ``AIProvider`` instance.

    The provider is selected by the ``QWEN_PROVIDER`` environment variable
    (default ``"dashscope"``).  The instance is created lazily and cached
    for the lifetime of the process.
    """
    global _cached_provider
    if _cached_provider is not None:
        return _cached_provider
    name = os.getenv("QWEN_PROVIDER", "dashscope").lower()
    cls = _PROVIDERS.get(name)
    if cls is None:
        available = ", ".join(sorted(_PROVIDERS)) or "(none)"
        print(
            f"Error: Unknown provider '{name}'. "
            f"Available providers: {available}",
            file=sys.stderr,
        )
        sys.exit(1)
    _cached_provider = cls()
    return _cached_provider


def _reset_provider() -> None:
    """Clear the cached provider instance (for testing only)."""
    global _cached_provider
    _cached_provider = None


# Register built-in provider
register_provider("dashscope", DashScopeProvider)


# ---------------------------------------------------------------------------
# Section 5: Provider-delegating public facade functions
# ---------------------------------------------------------------------------

def require_api_key(
        *,
        script_file: str | Path | None = None,
        domain: str = "",
) -> str:
    """Load and return the API key for the active provider, or exit with guidance.

    Token Plan keys (``sk-sp-...``) are accepted. Endpoint helpers use
    Token Plan-specific endpoints unless ``QWEN_BASE_URL`` overrides them.

    Parameters
    ----------
    script_file : str or Path, optional
        ``__file__`` of the calling script -- used to locate ``.env``.
    domain : str
        Human-readable domain name for error messages (e.g. "Image", "Video").
    """
    load_env(script_file)
    provider = get_provider()

    # Priority: QIANWEN_API_KEY (alias, if set) > DASHSCOPE_API_KEY (primary)
    fallback_env = provider.get_api_key_env_name()  # DASHSCOPE_API_KEY
    key = os.environ.get("QIANWEN_API_KEY", "").strip()
    if not key:
        key = os.environ.get(fallback_env, "").strip()

    if not key:
        console = provider.get_console_url()
        print(
            f"Error: QIANWEN_API_KEY/{fallback_env} not found.\n"
            f"Option 1: Add to .env file in project root or current directory:\n"
            f"  echo '{fallback_env}=sk-your-key-here' >> .env\n"
            f"Option 2: Export as environment variable:\n"
            f"  export {fallback_env}='sk-...'\n"
            f"Get key: {console}",
            file=sys.stderr,
        )
        sys.exit(1)

    return provider.validate_api_key(key, domain=domain)


def is_token_plan_key(api_key: str | None = None) -> bool:
    """Return whether an explicit or configured API key belongs to Token Plan."""
    if api_key is None:
        api_key = os.environ.get("QIANWEN_API_KEY", "").strip()
        if not api_key:
            api_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
    return api_key.startswith("sk-sp-")


def detect_api_key_type(script_file=None):
    """Return 'token-plan', 'payg', or 'not-set'."""
    load_env(script_file)
    key = (os.environ.get("QIANWEN_API_KEY") or
           os.environ.get("DASHSCOPE_API_KEY") or "").strip()
    if not key:
        return "not-set"
    return "token-plan" if key.startswith("sk-sp-") else "payg"


# ---------------------------------------------------------------------------
# Token Plan model allowlists (frozenset for O(1) lookup)
# ---------------------------------------------------------------------------

_TOKEN_PLAN_MODELS_PERSONAL: frozenset[str] = frozenset({
    # Text / Reasoning (some also support vision)
    "qwen3.8-max", "qwen3.8-flash", "qwen3.7-max", "qwen3.7-plus", "qwen3.6-flash",
    "glm-5.2",
    "deepseek-v4-pro", "deepseek-v4-pro-0813", "deepseek-v4-flash-0731",
    # Image
    "qwen-image-3.0-pro", "wan2.7-image", "wan2.7-image-pro",
    # Video
    "happyhorse-1.1-i2v", "happyhorse-1.1-t2v", "happyhorse-1.1-r2v",
    # Audio
    "qwen-audio-3.0-tts-plus", "qwen-audio-3.0-realtime-plus",  # realtime; platform-available, not implemented by any skill
    "qwen-audio-3.0-asr-flash",  # ASR; whitelist-reserved, no script entry in this repo
})

_TOKEN_PLAN_MODELS_TEAM: frozenset[str] = _TOKEN_PLAN_MODELS_PERSONAL | frozenset({
    # Extra text
    "qwen3.6-plus", "deepseek-v4-flash", "deepseek-v3.2",
    "kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5",
    "glm-5.1", "glm-5", "MiniMax-M2.5",
    # Extra image
    "qwen-image-2.0", "qwen-image-2.0-pro",
})


def validate_token_plan_model(
    api_key: str,
    model: str,
    plan_type: str | None = None,
) -> None:
    """Block unsupported models when using a Token Plan key."""
    if not is_token_plan_key(api_key):
        return

    if plan_type == "personal":
        allowed = _TOKEN_PLAN_MODELS_PERSONAL
    elif plan_type == "team":
        allowed = _TOKEN_PLAN_MODELS_TEAM
    else:
        allowed = _TOKEN_PLAN_MODELS_TEAM  # superset

    if model in allowed:
        return

    plan_label = f" ({plan_type})" if plan_type else ""
    print(
        f'Error: Model "{model}" is not available on Token Plan{plan_label}.\n'
        f"To use this model, switch to a standard API key (sk-...).\n"
        f"Read more: https://platform.qianwenai.com/docs/token-plan/overview",
        file=sys.stderr,
    )
    sys.exit(1)


def compat_base_url() -> str:
    """Return the OpenAI-compatible API base URL for the active provider."""
    return get_provider().compat_base_url()


def native_base_url() -> str:
    """Return the native API base URL for the active provider."""
    return get_provider().native_base_url()


def chat_url() -> str:
    """Convenience: full OpenAI-compatible chat/completions endpoint."""
    return f"{compat_base_url()}/chat/completions"


def has_oss_url(obj: Any) -> bool:
    """Check whether *obj* contains provider-managed file URLs.

    Backward-compatible alias for ``get_provider().has_managed_url()``.
    The name ``has_oss_url`` is retained for existing consumers; internally
    this delegates to the active provider's ``has_managed_url()`` method.
    """
    return get_provider().has_managed_url(obj)


def build_source_config(script_file: str | None = None) -> str | None:
    """Extract skill/agent from path. Supports .xxx/skills (dot-prefixed) and skills (OpenClaw)."""
    path = script_file
    if not path:
        for frame_info in inspect.stack():
            mod = inspect.getmodule(frame_info.frame)
            if frame_info.filename.endswith('.py') and (mod.__name__ if mod else '') != 'qianwen_lib':
                path = frame_info.filename
                break
    if not path or not path.endswith('.py'):
        return None

    candidates = [path]
    if sys.argv and sys.argv[0].endswith('.py'):
        argv_path = sys.argv[0]
        candidates.append(argv_path if os.path.isabs(argv_path) else os.path.join(os.getcwd(), argv_path))

    # Match: [/.agent]/skills/skill-name/scripts/xxx.py
    sep = r'[/\\]'
    pattern = sep + r'(?:\.([^/\\]+)' + sep + r')?skills' + sep + r'([^/\\]+)' + sep + r'scripts' + sep + r'[^/\\]+\.py$'
    for candidate in candidates:
        m = re.search(pattern, candidate)
        if m:
            agent, skill = m.group(1) or "default", m.group(2)
            if len(agent) <= 32 and len(skill) <= 32:
                return json.dumps({"channel": "qianwenai-skill", "tags": {"t1": skill, "t2": agent}}, separators=(',', ':'))
    return None


# ---------------------------------------------------------------------------
# Section 6: HTTP infrastructure
# ---------------------------------------------------------------------------

_RETRYABLE_CODES = frozenset({429, 500, 502, 503, 504})


def http_request(
        method: str,
        url: str,
        api_key: str,
        payload: dict[str, Any] | None = None,
        *,
        extra_headers: dict[str, str] | None = None,
        timeout: int = 120,
        retries: int = 2,
        backoff: float = 1.5,
) -> dict[str, Any]:
    """Generic HTTP request with retry and exponential backoff.

    Handles JSON serialisation, provider header injection, and retryable
    HTTP codes.
    """
    hdrs = get_provider().make_headers(api_key, payload)
    if extra_headers:
        hdrs.update(extra_headers)
    data = json.dumps(payload).encode("utf-8") if payload else None
    last_err = ""
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            last_err = f"HTTP {exc.code}: {body[:500]}"
            if api_key and len(api_key) > 8 and api_key in body:
                last_err = last_err.replace(api_key, mask_key(api_key))
            if exc.code not in _RETRYABLE_CODES or attempt >= retries:
                raise RuntimeError(last_err) from exc
            time.sleep(backoff * (2 ** attempt))
        except urllib.error.URLError as exc:
            last_err = str(exc.reason)
            if attempt >= retries:
                raise RuntimeError(f"Network error: {last_err}") from exc
            time.sleep(backoff * (2 ** attempt))
    raise RuntimeError(last_err)


def http_post(
        url: str,
        api_key: str,
        payload: dict[str, Any],
        *,
        timeout: int = 120,
        retries: int = 2,
        backoff: float = 1.5,
) -> dict[str, Any]:
    """Convenience: non-streaming POST, returns parsed JSON."""
    return http_request(
        "POST", url, api_key, payload,
        timeout=timeout, retries=retries, backoff=backoff,
    )


def stream_sse(
        url: str,
        api_key: str,
        payload: dict[str, Any],
        *,
        timeout: int = 180,
) -> Iterator[dict[str, Any]]:
    """Streaming POST.  Yields parsed SSE ``data:`` chunks.

    Automatically sets ``stream: true`` in the payload and sends the
    appropriate ``Accept`` header.
    """
    payload["stream"] = True
    hdrs = get_provider().make_headers(api_key, payload)
    hdrs["Accept"] = "text/event-stream"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=hdrs, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        if api_key and len(api_key) > 8 and api_key in body:
            body = body.replace(api_key, mask_key(api_key))
        raise RuntimeError(f"HTTP {exc.code}: {body[:500]}") from exc

    buf = b""
    try:
        while True:
            raw = resp.read(4096)
            if not raw:
                break
            buf += raw
            while b"\n" in buf:
                line_bytes, buf = buf.split(b"\n", 1)
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line or not line.startswith("data:"):
                    continue
                json_str = line[5:].strip()
                if json_str == "[DONE]":
                    return
                try:
                    yield json.loads(json_str)
                except json.JSONDecodeError:
                    pass
    finally:
        resp.close()


# ---------------------------------------------------------------------------
# Section 7: File upload / download
# ---------------------------------------------------------------------------

_BASE64_FILE_LIMIT = 7 * 1024 * 1024  # 7 MB (base64 adds ~33%; API limit is 10 MB)


def upload_local_file(api_key: str, model: str, fp: Path) -> str:
    """Upload a local file to the active provider's temp storage.

    Returns a provider-managed URL (e.g. ``oss://`` for DashScope).
    """
    return get_provider().upload_file(api_key, model, fp)


def resolve_file(
        value: str,
        *,
        api_key: str | None = None,
        model: str | None = None,
) -> str:
    """Resolve a file reference for API consumption.

    URLs (``http``, ``https``, ``data``, and provider-managed schemes)
    pass through unchanged.  Local files are handled based on context:

    - *api_key* + *model* provided: upload to temp storage.
    - Otherwise: convert to ``data:`` base64 URI (must be < 7 MB).
    """
    provider = get_provider()
    pass_through = ("http://", "https://", "data:") + provider.managed_url_schemes()
    if value.startswith(pass_through):
        return value
    # Strip file:// URI scheme prefix so Path() can resolve local paths
    if value.startswith("file://"):
        value = value[7:]
    p = Path(value)
    if not (p.exists() and p.is_file()):
        return value

    file_size = p.stat().st_size

    if api_key and model:
        managed_url = provider.upload_file(api_key, model, p)
        tag = "48 h TTL" if managed_url.startswith("oss://") else "custom OSS"
        print(f"Uploaded {p.name} -> {managed_url} ({tag})", file=sys.stderr)
        return managed_url

    if file_size > _BASE64_FILE_LIMIT:
        print(
            f"Warning: {p.name} is {file_size / 1024 / 1024:.1f} MB -- "
            "base64 may exceed the 10 MB API limit. "
            "Use --upload-files to auto-upload, or provide an online URL.",
            file=sys.stderr,
        )

    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def download_file(url: str, dest: Path, *, timeout: int = 120) -> Path:
    """Download a file from *url* to *dest*, creating parent dirs as needed."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "qianwenai-skill"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        dest.write_bytes(resp.read())
    return dest


# ---------------------------------------------------------------------------
# Section 8: Request / response utilities
# ---------------------------------------------------------------------------

def load_request(args: Any) -> dict[str, Any]:
    """Load request dict from ``--request`` or ``--file`` CLI argument."""
    if getattr(args, "request", None):
        return json.loads(args.request)
    if getattr(args, "file", None):
        return json.loads(Path(args.file).read_text(encoding="utf-8"))
    raise ValueError("Provide --request '{...}' or --file path/to/request.json")


def save_result(result: dict[str, Any], output_path: str | Path) -> None:
    """Write *result* as JSON to *output_path*, creating parent dirs."""
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_text(content: Any) -> str:
    """Extract plain text from a message ``content`` field.

    Handles ``str``, ``list[{type, text}]``, and ``None``.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    return text
        return json.dumps(content, ensure_ascii=False)
    if content is None:
        return ""
    return json.dumps(content, ensure_ascii=False)


def try_parse_json(text: str) -> Any | None:
    """Attempt to parse *text* as JSON; return ``None`` on failure."""
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Section 9: Async task polling
# ---------------------------------------------------------------------------

def poll_task(
        task_id: str,
        api_key: str,
        *,
        timeout_s: int = 600,
        interval: int = 10,
        verbose: bool = True,
) -> dict[str, Any]:
    """Poll an async task until it reaches a terminal state.

    Returns the final result dict.  Raises ``TimeoutError`` if
    *timeout_s* is exceeded.
    """
    provider = get_provider()
    url = provider.task_poll_url(task_id)
    terminals = provider.terminal_statuses()
    start = time.time()
    poll_count = 0
    while True:
        result = http_request("GET", url, api_key)
        elapsed = int(time.time() - start)
        poll_count += 1
        status = provider.extract_task_status(result)
        if verbose:
            print(f"  [{elapsed}s] task={task_id} status={status}", file=sys.stderr)
        if status in terminals:
            return result
        if time.time() - start > timeout_s:
            raise TimeoutError(
                f"Task {task_id} timed out after {timeout_s}s "
                f"({poll_count} polls, last status: {status})"
            )
        time.sleep(interval)


# ---------------------------------------------------------------------------
# Section 10: Update-check signal
# ---------------------------------------------------------------------------

try:
    from gossamer import run as _run_update_signal_impl
except ImportError:
    _run_update_signal_impl = None  # type: ignore[assignment]


def run_update_signal(caller: str | Path | None = None) -> None:
    """Emit update-check signals to stderr (non-blocking, failure-safe).

    Parameters
    ----------
    caller : str or Path, optional
        ``__file__`` of the calling script.
    """
    if _run_update_signal_impl:
        try:
            _run_update_signal_impl(caller=caller or __file__)
        except Exception:
            pass
