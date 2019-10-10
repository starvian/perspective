# *****************************************************************************
#
# Copyright (c) 2019, the Perspective Authors.
#
# This file is part of the Perspective library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from perspective import PerspectiveWidget, Table


# TODO: finish
class TestWidget:

    def test_widget_load_table(self):
        table = Table({"a": [1, 2, 3]})
        widget = PerspectiveWidget()
        widget.load(table)
        assert widget.columns == ["a"]

    def test_widget_load_data(self):
        widget = PerspectiveWidget()
        widget.load({"a": [1, 2, 3]})
        assert widget.columns == ["a"]

    def test_widget_load_table_with_options(self):
        table = Table({"a": [1, 2, 3]})
        widget = PerspectiveWidget()
        # options should be disregarded when loading Table
        widget.load(table, limit=1)
        assert widget.columns == ["a"]
        table_name = widget.manager._tables.keys()[0]
        table = widget.manager._tables[table_name]
        assert table.size() == 3

    def test_widget_load_data_with_options(self):
        widget = PerspectiveWidget()
        # options should be forwarded to the Table constructor
        widget.load({"a": [1, 2, 3]}, limit=1)
        assert widget.columns == ["a"]
        table_name = widget.manager._tables.keys()[0]
        table = widget.manager._tables[table_name]
        assert table.size() == 1
