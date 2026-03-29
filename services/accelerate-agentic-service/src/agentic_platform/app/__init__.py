"""App layer — domain implementations and agent discovery."""

def get_all_agent_configs():
    """Import agent configs from all domains.

    To add a new agent: create app/<name>/agent.py with a `config` variable,
    then import it here.
    """
    configs = []
    from src.agentic_platform.app.campaigns.agent import config as campaigns_config
    configs.append(campaigns_config)

    from src.agentic_platform.app.accelera.agent import config as accelera_config
    configs.append(accelera_config)

    return configs
