from sqlite3 import adapt

if __name__ == "__main__":
	from nessie_api.models import Plugin, Action
	from render import render


	class MyAdapter:
		def __init__(self, graphs, plugin):
			self._graphs = graphs
			self._plugin = plugin

		def get_workspace_count(self):        return len(self._graphs)

		def get_active_workspace_index(self): return 0

		def get_graph_at(self, i):            return self._graphs[i]

		def get_plugin_html_at(self, i):
			action = Action(name="visualise_graph", payload=self._graphs[i])
			return self._plugin.handle(action)

		def get_visualiser_name_at(self, i):
			return self._plugin.name

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

	adapter = MyAdapter(graphs=[graph1, graph2, graph3], plugin=plugin_instance)

	with open("test.html", "w") as f:
		f.write(render(adapter))
