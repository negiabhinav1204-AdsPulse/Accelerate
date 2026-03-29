import logging
import os

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

_initialized: bool = False


def init_sentry() -> bool:
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return False

    sentry_sdk.init(
        dsn=dsn,
        send_default_pii=False,
        environment=os.getenv("SENTRY_ENVIRONMENT", "local"),
        integrations=[
            LoggingIntegration(
                level=logging.ERROR,
                event_level=logging.ERROR,
            ),
        ],
    )

    global _initialized
    _initialized = True
    return True


def capture_exception(exc: BaseException) -> None:
    if _initialized:
        sentry_sdk.capture_exception(exc)
