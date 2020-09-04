################################################################################
#
# Copyright (c) 2019, the Perspective Authors.
#
# This file is part of the Perspective library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import os
import sys

from concurrent.futures import ProcessPoolExecutor

import tornado
from tornado.ioloop import IOLoop

from client import WebsocketClient
from server import start


def get_free_port():
    sockets = tornado.netutil.bind_sockets(0, '127.0.0.1')
    return sockets[0].getsockname()[:2][1]


@tornado.gen.coroutine
def run():
    port = get_free_port()
    # server = multiprocessing.Process(target=start, args=(port, ))

    # server.start()
    # server.join(15)

    client = WebsocketClient("ws://127.0.0.1:{}/".format(8888))
    yield client.connect()
    yield client.register_on_update()
    yield client.start()

if __name__ == "__main__":
    loop = tornado.ioloop.IOLoop.current()
    loop.add_callback(run)
    loop.start()
