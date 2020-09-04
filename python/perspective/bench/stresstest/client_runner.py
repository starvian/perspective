################################################################################
#
# Copyright (c) 2019, the Perspective Authors.
#
# This file is part of the Perspective library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import os
import sys
import signal
import asyncio
import logging

from datetime import datetime

import perspective
from client import PerspectiveWebSocketClient

if __name__ == "__main__":
    # If this module is run through a subprocess, create its own instance of
    # the results table and dump to arrow at the end.
    logging.basicConfig(level=logging.DEBUG)
    HERE = os.path.abspath(os.path.dirname(__file__))

    RESULTS_SCHEMA = {
        "client_id": str,
        "cmd": str,
        "method": str,
        "args": str,
        "send_timestamp": datetime,
        "receive_timestamp": datetime,
        "microseconds_on_wire": float,
        "message_id": int,
        "errored": bool,
        "binary": bool,
        "byte_length": int
    }

    RESULTS_TABLE = perspective.Table(RESULTS_SCHEMA)

    # The order of arguments as delivered through `main.py`.
    RESULTS_FOLDER = sys.argv[1]
    CLIENT_ID = sys.argv[2]
    TEST_TYPE = sys.argv[3]
    URL = sys.argv[4]

    def dump_and_exit(sig, frame):
        dt = "{:%Y%m%dT%H%M%S}".format(datetime.now())
        filename = "results_{}_{}.arrow".format(CLIENT_ID, dt)
        logging.critical(
            "KeyboardInterrupt: dumping %s rows of results to %s",
            RESULTS_TABLE.size(),
            filename)

        with open(os.path.join(HERE, "results", RESULTS_FOLDER, filename), "wb") as results_arrow:
            results_arrow.write(RESULTS_TABLE.view().to_arrow())

        logging.critical("Exiting %s", CLIENT_ID)
        sys.exit(0)

    signal.signal(signal.SIGINT, dump_and_exit)

    def run(client_id):
        """Create a new client and run it forever on a new IOLoop."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        client = PerspectiveWebSocketClient(
            URL, client_id, RESULTS_TABLE, test_type=TEST_TYPE)
        loop.run_until_complete(client.run_until_timeout())
        loop.run_forever()

    run(CLIENT_ID)
