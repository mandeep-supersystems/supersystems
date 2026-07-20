import os
from datetime import timedelta


class BaseConfig:
    SECRET_KEY = os.getenv("SECRET_KEY", "supersystems-secret-key-change-in-production")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    CACHE_TYPE = "redis"
    CACHE_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    RATELIMIT_STORAGE_URI = os.getenv("REDIS_URL", "redis://localhost:6379/1")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://postgres:Rewari%40123@localhost:5432/SUPERSYSTEM"
    )
    CACHE_TYPE = "SimpleCache"
    RATELIMIT_STORAGE_URI = "memory://"


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL", "postgresql://postgres:Rewari%40123@localhost:5432/SUPERSYSTEM_test"
    )


class UATConfig(BaseConfig):
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "UAT_DATABASE_URL", "postgresql://postgres:Rewari%40123@localhost:5432/SUPERSYSTEM_uat"
    )


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "uat": UATConfig,
    "production": ProductionConfig,
}
