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

mod clone;

use thiserror::*;

#[cfg(test)]
mod tests;

use crate::proto;

#[derive(Error, Debug)]
pub enum ClientError {
    // #[error("Internal error: {0}")]
    #[error("Abort(): {0}")]
    Internal(String),

    #[error("Client not yet initialized")]
    NotInitialized,

    #[error("Unknown error: {0}")]
    Unknown(String),

    #[error("Unwrapped option")]
    Option,

    #[error("Bad string")]
    Utf8(#[from] std::str::Utf8Error),

    #[error("Undecipherable server message {0:?}")]
    DecodeError(#[from] prost::DecodeError),

    #[error("Unexpected response {0:?}")]
    ResponseFailed(Box<proto::response::ClientResp>),

    #[error("Not yet implemented {0:?}")]
    NotImplemented(&'static str),

    #[error("Can't use both `limit` and `index` parameters")]
    BadTableOptions,
}

pub type ClientResult<T> = Result<T, ClientError>;

impl From<proto::response::ClientResp> for ClientError {
    fn from(value: proto::response::ClientResp) -> Self {
        match value {
            proto::response::ClientResp::ServerError(x) => ClientError::Internal(x.message),
            x => ClientError::ResponseFailed(Box::new(x)),
        }
    }
}
