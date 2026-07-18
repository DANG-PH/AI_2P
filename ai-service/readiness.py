"""Shared readiness policy for deployment checks and live AI sessions."""

from collections.abc import Callable

from model_errors import ModelUnavailableError


OptionalErrorHandler = Callable[[str, Exception], None]


def _run_component_preflight(component, fallback_name: str) -> str:
    preflight = getattr(component, "preflight", None)
    if callable(preflight):
        result = preflight()
        return str(result or fallback_name)
    return f"injected:{fallback_name}"


def preflight_runtime(
    *,
    audio,
    asr,
    fast,
    quality,
    on_optional_error: OptionalErrorHandler | None = None,
) -> tuple[dict[str, str | None], list[str]]:
    """Require VAD, ASR, and at least one usable translation path."""

    capabilities: dict[str, str | None] = {
        "vad": _run_component_preflight(audio, "audio"),
        "asr": _run_component_preflight(asr, "asr"),
        "fastTranslation": None,
        "qualityTranslation": None,
    }
    warnings: list[str] = []
    translation_errors = []

    for key, component, warning in (
        (
            "fastTranslation",
            fast,
            "FAST_TRANSLATION_UNAVAILABLE",
        ),
        (
            "qualityTranslation",
            quality,
            "QUALITY_TRANSLATION_UNAVAILABLE",
        ),
    ):
        try:
            capabilities[key] = _run_component_preflight(component, key)
        except Exception as error:
            warnings.append(warning)
            translation_errors.append(f"{key}: {error}")
            if on_optional_error is not None:
                on_optional_error(key, error)

    if (
        capabilities["fastTranslation"] is None
        and capabilities["qualityTranslation"] is None
    ):
        raise ModelUnavailableError(
            "No translation path is ready. "
            + "; ".join(translation_errors),
        )

    return capabilities, warnings
