// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

#![feature(if_let_guard)]
#![feature(lazy_cell)]

mod client;

use client::*;
use pyo3::prelude::*;
use pyo3_asyncio::tokio::re_exports::runtime::Builder;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{fmt, EnvFilter};

/// Create a tracing filter which mimics the default behavior of reading from
/// env, customized to exclude timestamp.
/// [`tracing` filter docs](https://docs.rs/tracing-subscriber/latest/tracing_subscriber/layer/index.html#per-layer-filtering)
fn init_tracing() {
    let fmt_layer = fmt::layer().without_time().with_target(true);
    let filter_layer = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new("debug"))
        .unwrap();

    tracing_subscriber::registry()
        .with(filter_layer)
        .with(fmt_layer)
        .init();
}

/// A Python module implemented in Rust.
#[pymodule]
fn perspective(py: Python, m: &PyModule) -> PyResult<()> {
    init_tracing();
    let mut builder = Builder::new_multi_thread();
    if let Some(threads) = std::env::var("PSP_PY_WORKER_THREADS")
        .ok()
        .and_then(|v| v.parse().ok())
    {
        builder.worker_threads(threads);
    }
    builder.enable_all();
    pyo3_asyncio::tokio::init(builder);
    m.add_class::<client_async::PyAsyncClient>()?;
    m.add_class::<client_sync::PySyncClient>()?;
    m.add_class::<client_async::PyAsyncTable>()?;
    m.add_class::<client_async::PyAsyncView>()?;
    m.add_class::<client_async::PyAsyncServer>()?;
    // m.add_class::<client::PerspectivePyError>()?;
    m.add(
        "PerspectiveCppError",
        py.get_type::<client::PerspectivePyError>(),
    )?;
    // m.add_function(wrap_pyfunction!(init_tracing, m)?)?;
    m.add_function(wrap_pyfunction!(client_async::create_async_client, m)?)?;
    m.add_function(wrap_pyfunction!(client_sync::create_sync_client, m)?)?;
    Ok(())
}
