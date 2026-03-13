from nessie_web.render import render
from nessie_api.models import Action, plugin
from nessie_api.protocols import Context

def nessie_web_plugin_handler(action: Action, context: Context) -> str:
    return render(context)

@plugin("Nessie Web")
def nessie_web_plugin():
    return {
        "handlers": {
            "render": nessie_web_plugin_handler,
        },
        "requires": {},
        "setup_requires": {},
    }