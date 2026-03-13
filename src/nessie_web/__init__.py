"""nessie_web — framework-agnostic HTML renderer za Nessie Graph Explorer."""
from .render import render
from .protocol import NessieAdapter
__all__ = ["render", "NessieAdapter"]
