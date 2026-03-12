"""
nessie_explorer.protocol
========================
Jedini kontrakt koji host aplikacija mora da implementira.
"""
from __future__ import annotations
from typing import TYPE_CHECKING, Optional, Protocol, runtime_checkable
from nessie_api.models import Graph


@runtime_checkable
class NessieAdapter(Protocol):
	"""
	Adapter između host aplikacije i Nessie renderera.

	Host sam poziva plugin i predaje gotov HTML string —
	renderer nema nikakvu zavisnost od nessie_api Plugin klase.

	Primer::

		class MyAdapter:
			def __init__(self, graphs, plugin):
				self._graphs = graphs
				self._plugin = plugin

			def get_workspace_count(self):		return len(self._graphs)
			def get_active_workspace_index(self): return 0

			def get_graph_at(self, i):
				return self._graphs[i]

			def get_plugin_html_at(self, i):
				action = Action(name="visualise_graph", payload=self._graphs[i])
				return self._plugin.handle(action)
	"""

	def get_workspace_count(self) -> int:
		"""Ukupan broj workspace tabova. Mora biti ≥ 1."""
		...

	def get_graph_at(self, index: int) -> "Graph":
		"""
		Vraća Graph objekat na poziciji *index*.
		``graph.name`` se koristi kao naziv taba i sufiks SVG id-a
		(``main-view-{graph.name}``).
		"""
		...

	def get_plugin_html_at(self, index: int) -> str:
		"""
		Vraća gotov HTML string koji je plugin već generisao za graf
		na poziciji *index*.

		String se lepi as-is u template bez ikakve transformacije.
		Tipično::

			action = Action(name="visualise_graph", payload=self.get_graph_at(index))
			return plugin.handle(action)
		"""
		...

	def get_active_workspace_index(self) -> int:
		"""
		Indeks workspacea koji je aktivan na prvom učitavanju.
		Mora biti u ``[0, get_workspace_count())``.
		"""
		...

	def get_visualiser_name_at(self, active_index):
		"""
		Vraća ime plugina koji se koristi za prikaz trenutno aktivnog grafa
		"""
		pass

	def get_active_filters_at(self, index: int) -> list:
		"""
		Vraća listu FilterExpression objekata koji su trenutno aktivni za graf
		na poziciji *index*. Svaki element mora imati metod .to_json() koji
		vraća {"attr_name": str, "operator": str, "value": any}.
		Default: prazna lista.
		"""
		return []
