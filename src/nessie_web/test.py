from sqlite3 import adapt

from nessie_api.models.console_message import ConsoleMessage, ConsoleMessageType

if __name__ == "__main__":
	from nessie_api.models import Edge, Action, Node, Attribute, FilterExpression, FilterOperator
	from render import render


	class MyAdapter:
		def __init__(self, graphs, plugin):
			self._graphs = graphs
			self._plugin = plugin

		def get_workspace_count(self):        return len(self._graphs)

		def get_active_workspace_index(self): return 2

		def get_graph_at(self, i):            return self._graphs[i]

		def get_plugin_html_at(self, i):
			action = Action(name="visualise_graph", payload=self._graphs[i])
			return self._plugin.handle(action)

		def get_visualiser_name_at(self, i):
			return self._plugin.name

		def get_active_filters_at(self, index: int) -> list:
			return [
				FilterExpression("test", FilterOperator.EQ, "value"),
				FilterExpression("test2", FilterOperator.GT, "value2")
			]

		def get_console_messages_at(self, index: int) -> list:
			"""
			Vraća listu ConsoleMessage objekata koji će biti prikazani u konzoli
			workspace-a pri prvom učitavanju. Svaki element mora imati metod
			.to_json() koji vraća {"message": str, "type": "info"|"ok"|"warn"|"error"}.
			Default: prazna lista.
			"""
			return [
				ConsoleMessage.info("This is an info message"),
				ConsoleMessage.input("input 1"),
				ConsoleMessage.warn("This is a warning message"),
				ConsoleMessage.input("input 2"),
				ConsoleMessage.error("This is an error message"),
				ConsoleMessage.input("input 3"),
				ConsoleMessage.ok("This is an ok message"),
				ConsoleMessage.input("input 4"),
				ConsoleMessage.warn("This is an warning message"),
			]

	from nessie_npm_dependencies_plugin import npm_dependencies_plugin
	from neisse_graph_visualiser_block import neisse_graph_visualiser_block_plugin

	plugin_instance = neisse_graph_visualiser_block_plugin()

	action = Action(name="load", payload={"Package Name": "mysql"})
	ds = npm_dependencies_plugin()
	graph1 = ds.handle(action)
	action = Action(name="load", payload={"Package Name": "axios"})
	graph2 = ds.handle(action)
	action = Action(name="load", payload={"Package Name": "express"})
	graph3 = ds.handle(action)

	node_a = Node("A", attributes={"label": Attribute("label", "Node A")})
	node_b = Node("B", attributes={"label": Attribute("label", "Node B")})
	node_c = Node("C", attributes={"label": Attribute("label", "Node C")})
	graph3.add_node(node_a)
	graph3.add_node(node_b)
	graph3.add_node(node_c)
	graph3.add_edge(Edge("edge2", source=node_a, target=node_b))
	graph3.add_edge(Edge("edge3", source=node_b, target=node_c))

	adapter = MyAdapter(graphs=[graph1, graph2, graph3], plugin=plugin_instance)

	with open("test.html", "w") as f:
		f.write(render(adapter))
