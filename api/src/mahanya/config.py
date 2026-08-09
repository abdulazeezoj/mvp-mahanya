"""Layered configuration: in-code defaults -> config.yaml/.env -> CLI overrides."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    YamlConfigSettingsSource,
)

API_DIR = Path(__file__).resolve().parents[2]


class SchedulerThresholds(BaseSettings):
    """Deterministic rule thresholds, all in seconds unless noted."""

    min_green_sec: float = 10.0
    max_green_sec: float = 60.0
    yellow_sec: float = 3.0
    all_red_sec: float = 2.0
    anti_starvation_wait_sec: float = 90.0


class SimulationConfig(BaseSettings):
    """SUMO scenario paths and control-loop timing."""

    network_dir: Path = API_DIR / "src" / "mahanya" / "sumo" / "network"
    net_file: str = "sapon.net.xml"
    #: Default scenario, used when a route isn't scoped to a specific one.
    sumocfg_file: str = "sapon_peak.sumocfg"
    step_length_sec: float = 1.0
    control_interval_sec: float = 1.0
    sumo_binary: str = "sumo"
    tls_id: str = "J_sapon"

    @property
    def sumocfg_path(self) -> Path:
        return self.network_dir / self.sumocfg_file

    @property
    def net_path(self) -> Path:
        return self.network_dir / self.net_file

    def sumocfg_path_for(self, sumocfg_file: str) -> Path:
        return self.network_dir / sumocfg_file


class ModelConfig(BaseSettings):
    """Transformer hyperparameters and artifact location."""

    sequence_length: int = 16
    d_model: int = 32
    n_heads: int = 4
    n_layers: int = 2
    dim_feedforward: int = 64
    dropout: float = 0.1
    num_phases: int = 9
    num_features_per_direction: int = 4
    checkpoint_path: Path = API_DIR / "models" / "phase_recommender.pt"


class DashboardConfig(BaseSettings):
    """Runtime relay behaviour toward the web dashboard."""

    refresh_interval_sec: float = 1.0
    decision_log_path: Path = API_DIR / "data" / "processed" / "decision_log.jsonl"
    max_history: int = 500


class Config(BaseSettings):
    """Single configuration surface for MaHanya's api/ project."""

    model_config = SettingsConfigDict(
        env_prefix="MAHANYA_",
        env_nested_delimiter="__",
        yaml_file=API_DIR / "config.yaml",
        extra="ignore",
    )

    data_dir: Path = API_DIR / "data"
    raw_counts_csv: Path = API_DIR / "data" / "raw" / "sapon_traffic_counts.csv"
    sequences_path: Path = API_DIR / "data" / "processed" / "sequences.parquet"

    scheduler: SchedulerThresholds = Field(default_factory=SchedulerThresholds)
    simulation: SimulationConfig = Field(default_factory=SimulationConfig)
    model: ModelConfig = Field(default_factory=ModelConfig)
    dashboard: DashboardConfig = Field(default_factory=DashboardConfig)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Precedence, highest first: explicit init kwargs (CLI overrides) > env
        # vars > .env file > config.yaml > in-code defaults.
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            YamlConfigSettingsSource(settings_cls),
            file_secret_settings,
        )


def get_config() -> Config:
    return Config()
