"""
Tầng 0 — Config Layer

Quản lý deployment tier, language pair, model map,
glossary tĩnh + session glossary động.
"""


class DeploymentConfig:
    """Chọn tier (edge/server) và lang_pair trước khi chạy."""

    def __init__(self, tier: str = "server", lang_pair: str = "vi-en"):
        assert tier in ("edge", "server"), f"Unknown tier: {tier}"
        self.tier = tier
        self.lang_pair = lang_pair

    # ponytail: model_map sẽ load từ file YAML/JSON khi triển khai thật
    def get_model_map(self) -> dict:
        raise NotImplementedError
