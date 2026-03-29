"""Connections models (campaign-service)."""

from pydantic import BaseModel, Field, model_validator


class AccountInfo(BaseModel):
    account_id: str | None = Field(None, alias="accountId")
    account_name: str | None = Field(None, alias="accountName")
    account_type: str | None = Field(None, alias="accountType")
    platform: str | None = None
    timezone: str | None = None
    currency: str | None = None
    status: str | None = None
    parent_account_id: str | None = Field(None, alias="parentAccountId")
    child_account_ids: list[str] | None = Field(None, alias="childAccountIds")
    supported_campaign_types: list[str] | None = Field(None, alias="supportedCampaignTypes")
    model_config = {"populate_by_name": True}


class PlatformConnection(BaseModel):
    user_email: str | None = Field(None, alias="userEmail")
    customer_id: str | None = Field(None, alias="customerId")
    account_id: str | None = Field(None, alias="accountId")
    connected_at: str | None = Field(None, alias="connectedAt")
    last_refreshed_at: str | None = Field(None, alias="lastRefreshedAt")
    account_count: int = Field(0, alias="accountCount")
    token_valid: bool = Field(True, alias="tokenValid")
    meta_page_id: str | None = Field(None, alias="metaPageId")
    account: AccountInfo | None = None
    model_config = {"populate_by_name": True}


class PlatformConnectionInfo(BaseModel):
    platform: str
    connected: bool = False
    connection_count: int = Field(0, alias="connectionCount")
    connections: list[PlatformConnection] = Field(default_factory=list)
    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def _normalize_connection(cls, data):
        """API returns singular 'connection' object — normalize to 'connections' list."""
        if isinstance(data, dict) and "connection" in data and "connections" not in data:
            conn = data.pop("connection")
            data["connections"] = [conn] if conn else []
        return data


class ConnectionsResponse(BaseModel):
    organization_id: str = Field(..., alias="organizationId")
    platforms: dict[str, PlatformConnectionInfo] = Field(default_factory=dict)
    total_connections: int = Field(0, alias="totalConnections")
    model_config = {"populate_by_name": True}


class ConnectedPlatform(BaseModel):
    """Filtered platform connection for pipeline use."""
    platform: str
    account_id: str | None = None
    customer_id: str | None = None
    currency: str | None = None
    account_name: str | None = None
    timezone: str | None = None
    model_config = {"frozen": True}
