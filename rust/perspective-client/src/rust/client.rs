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

use std::collections::HashMap;
use std::pin::Pin;
use std::sync::atomic::AtomicU32;
use std::sync::Arc;

use async_lock::{Mutex, RwLock};
use futures::Future;
use nanoid::*;
use prost::Message;

use crate::proto::make_table_data::Data;
use crate::proto::request::ClientReq;
use crate::proto::response::ClientResp;
use crate::proto::{
    ColumnType, GetFeaturesReq, GetFeaturesResp, GetHostedTablesReq, GetHostedTablesResp,
    MakeTableData, MakeTableReq, Request, Response, ServerSystemInfoReq, TableUpdateReq,
    ViewToColumnsStringResp,
};
use crate::table::{SystemInfo, Table, TableInitOptions};
use crate::table_data::{TableData, UpdateData};
use crate::utils::*;
use crate::view::ViewWindow;

/// Metadata about what features are supported by the `Server` this `Client`
/// is connected to.
pub type Features = Arc<GetFeaturesResp>;

impl GetFeaturesResp {
    pub fn default_op(&self, col_type: ColumnType) -> Option<&String> {
        self.filter_ops.get(&(col_type as u32))?.options.first()
    }
}

type BoxFn<I, O> = Box<dyn Fn(I) -> O + Send + Sync + 'static>;
type PinBoxFut<O> = Pin<Box<dyn Future<Output = O> + Send + 'static>>;

pub trait IntoBoxFnPinBoxFut<I, O> {
    /// Convert an `impl Fn(I) -> impl Future<Output = O>` (with sufficiently
    /// strict autotrait bounds) into a heap allocated version, which is
    /// useful for storing them in dynamic data structures.
    fn into_box_fn_pin_bix_fut(self) -> BoxFn<I, PinBoxFut<O>>;
}

impl<T, U, I, O> IntoBoxFnPinBoxFut<I, O> for T
where
    T: Fn(I) -> U + Send + Sync + 'static,
    U: Future<Output = O> + Send + 'static,
{
    fn into_box_fn_pin_bix_fut(self) -> BoxFn<I, PinBoxFut<O>> {
        Box::new(move |resp| Box::pin(self(resp)) as Pin<Box<dyn Future<Output = _> + Send>>)
    }
}

type Subscriptions<C> = Arc<RwLock<HashMap<u32, C>>>;
type OnceCallback = Box<dyn FnOnce(ClientResp) -> Result<(), ClientError> + Send + Sync + 'static>;
type SendCallback = Arc<dyn Fn(&Client, &Request) -> PinBoxFut<()> + Send + Sync + 'static>;

#[derive(Clone)]
#[doc = include_str!("../../docs/client.md")]
pub struct Client {
    features: Arc<Mutex<Option<Features>>>,
    send: SendCallback,
    id_gen: Arc<AtomicU32>,
    subscriptions_once: Subscriptions<OnceCallback>,
    subscriptions: Subscriptions<BoxFn<ClientResp, PinBoxFut<Result<(), ClientError>>>>,
}

impl std::fmt::Debug for Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Client")
            .field("id_gen", &self.id_gen)
            .finish()
    }
}

impl Client {
    /// Create a new client instance with a closure over a
    /// `Server::handle_request`.
    pub fn new<T, U>(send_request: T) -> Self
    where
        T: Fn(&Client, &Vec<u8>) -> U + Send + Sync + 'static,
        U: Future<Output = ()> + Send + 'static,
    {
        let send: SendCallback = Arc::new(move |client, req| {
            let mut bytes: Vec<u8> = Vec::new();
            req.encode(&mut bytes).unwrap();
            Box::pin(send_request(client, &bytes))
        });

        Client {
            features: Arc::default(),
            id_gen: Arc::new(AtomicU32::new(1)),
            subscriptions_once: Arc::default(),
            subscriptions: Subscriptions::default(),
            send,
        }
    }

    /// Handle a message from the external message queue.
    pub async fn handle_response(&self, msg: &Vec<u8>) -> ClientResult<()> {
        let msg = Response::decode(msg.as_slice())?;
        tracing::info!("RECV {}", msg);
        let payload = msg.client_resp.ok_or(ClientError::Option)?;
        let mut wr = self.subscriptions_once.try_write().unwrap();
        if let Some(handler) = (*wr).remove(&msg.msg_id) {
            drop(wr);
            handler(payload)?;
        } else if let Some(handler) = self.subscriptions.try_read().unwrap().get(&msg.msg_id) {
            drop(wr);
            handler(payload).await?;
        } else {
            tracing::warn!("Received unsolicited server message");
        }

        Ok(())
    }

    pub async fn init(&self) -> ClientResult<()> {
        let msg = Request {
            msg_id: self.gen_id(),
            entity_id: "".to_owned(),
            client_req: Some(ClientReq::GetFeaturesReq(GetFeaturesReq {})),
        };

        *self.features.lock().await = Some(Arc::new(match self.oneshot(&msg).await {
            ClientResp::GetFeaturesResp(features) => Ok(features),
            resp => Err(resp),
        }?));

        Ok(())
    }

    /// Generate a message ID unique to this client.
    pub(crate) fn gen_id(&self) -> u32 {
        self.id_gen
            .fetch_add(1, std::sync::atomic::Ordering::Acquire)
    }

    pub(crate) fn unsubscribe(&self, update_id: u32) -> ClientResult<()> {
        let callback = self
            .subscriptions
            .try_write()
            .unwrap()
            .remove(&update_id)
            .ok_or(ClientError::Unknown("remove_update".to_string()))?;

        drop(callback);
        Ok(())
    }

    /// Register a callback which is expected to respond exactly once.
    pub(crate) async fn subscribe_once(
        &self,
        msg: &Request,
        on_update: Box<dyn FnOnce(ClientResp) -> ClientResult<()> + Send + Sync + 'static>,
    ) {
        self.subscriptions_once
            .try_write()
            .unwrap()
            .insert(msg.msg_id, on_update);

        tracing::info!("SEND {}", msg);
        (self.send)(self, msg).await;
    }

    pub(crate) async fn subscribe(
        &self,
        msg: &Request,
        on_update: BoxFn<ClientResp, PinBoxFut<Result<(), ClientError>>>,
    ) {
        self.subscriptions
            .try_write()
            .unwrap()
            .insert(msg.msg_id, on_update);
        tracing::info!("SEND {}", msg);
        (self.send)(self, msg).await;
    }

    /// Send a `ClientReq` and await both the successful completion of the
    /// `send`, _and_ the `ClientResp` which is returned.
    pub(crate) async fn oneshot(&self, msg: &Request) -> ClientResp {
        let (sender, receiver) = futures::channel::oneshot::channel::<ClientResp>();
        let callback = Box::new(move |msg| sender.send(msg).map_err(|x| x.into()));
        self.subscriptions_once
            .try_write()
            .unwrap()
            .insert(msg.msg_id, callback);

        tracing::info!("SEND {}", msg);
        (self.send)(self, msg).await;
        receiver.await.unwrap()
    }

    pub(crate) fn get_features(&self) -> ClientResult<Features> {
        Ok(self
            .features
            .try_lock()
            .ok_or(ClientError::NotInitialized)?
            .as_ref()
            .ok_or(ClientError::NotInitialized)?
            .clone())
    }

    #[doc = include_str!("../../docs/client/table.md")]
    pub async fn table(&self, input: TableData, options: TableInitOptions) -> ClientResult<Table> {
        let entity_id = match options.name.clone() {
            Some(x) => x.to_owned(),
            None => nanoid!(),
        };

        if let TableData::View(view) = &input {
            let window = ViewWindow::default();
            let arrow = view.to_arrow(window).await?;
            let mut table = self
                .crate_table_inner(
                    TableData::Update(UpdateData::Arrow(arrow)),
                    options,
                    entity_id,
                )
                .await?;

            let on_update_token = view
                .on_update(
                    {
                        let table = table.clone();
                        move |update: crate::view::OnUpdateArgs| {
                            let table = table.clone();
                            async move {
                                table
                                    .update(
                                        UpdateData::Arrow(update.delta.expect("No update??")),
                                        crate::UpdateOptions::default(),
                                    )
                                    .await
                                    .expect("TODO: errors here?");
                            }
                        }
                    },
                    crate::OnUpdateOptions {
                        mode: Some(crate::OnUpdateMode::Row),
                    },
                )
                .await?;

            table.view_update_token = Some(on_update_token);
            Ok(table)
        } else {
            self.crate_table_inner(input, options, entity_id).await
        }
    }

    async fn crate_table_inner(
        &self,
        input: TableData,
        options: TableInitOptions,
        entity_id: String,
    ) -> ClientResult<Table> {
        let msg = Request {
            msg_id: self.gen_id(),
            entity_id: entity_id.clone(),
            client_req: Some(ClientReq::MakeTableReq(MakeTableReq {
                data: Some(input.into()),
                options: Some(options.clone().try_into()?),
            })),
        };

        let client = self.clone();
        match self.oneshot(&msg).await {
            ClientResp::MakeTableResp(_) => Ok(Table::new(entity_id, client, options)),
            resp => Err(resp.into()),
        }
    }

    #[doc = include_str!("../../docs/client/open_table.md")]
    pub async fn open_table(&self, entity_id: String) -> ClientResult<Table> {
        let names = self.get_hosted_table_names().await?;
        if names.contains(&entity_id) {
            let options = TableInitOptions::default();
            let client = self.clone();
            Ok(Table::new(entity_id, client, options))
        } else {
            Err(ClientError::Unknown("Unknown table".to_owned()))
        }
    }

    #[doc = include_str!("../../docs/client/get_hosted_table_names.md")]
    pub async fn get_hosted_table_names(&self) -> ClientResult<Vec<String>> {
        let msg = Request {
            msg_id: self.gen_id(),
            entity_id: "".to_owned(),
            client_req: Some(ClientReq::GetHostedTablesReq(GetHostedTablesReq {})),
        };

        match self.oneshot(&msg).await {
            ClientResp::GetHostedTablesResp(GetHostedTablesResp { table_names }) => Ok(table_names),
            resp => Err(resp.into()),
        }
    }

    #[doc = include_str!("../../docs/client/system_info.md")]
    pub async fn system_info(&self) -> ClientResult<SystemInfo> {
        let msg = Request {
            msg_id: self.gen_id(),
            entity_id: "".to_string(),
            client_req: Some(ClientReq::ServerSystemInfoReq(ServerSystemInfoReq {})),
        };

        match self.oneshot(&msg).await {
            ClientResp::ServerSystemInfoResp(resp) => Ok(resp.into()),
            resp => Err(resp.into()),
        }
    }
}

fn replace(x: Data) -> Data {
    match x {
        Data::FromArrow(_) => Data::FromArrow("<< redacted >>".to_string().encode_to_vec()),
        Data::FromRows(_) => Data::FromRows("<< redacted >>".to_string()),
        Data::FromCols(_) => Data::FromCols("".to_string()),
        Data::FromCsv(_) => Data::FromCsv("".to_string()),
        x => x,
    }
}

/// `prost` generates `Debug` implementations that includes the `data` field,
/// which makes logs output unreadable. This `Display` implementation hides
/// fields that we don't want ot display in the logs.
impl std::fmt::Display for Request {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut msg = self.clone();
        msg = match msg {
            Request {
                client_req:
                    Some(ClientReq::MakeTableReq(MakeTableReq {
                        ref options,
                        data:
                            Some(MakeTableData {
                                data: Some(ref data),
                            }),
                    })),
                ..
            } => Request {
                client_req: Some(ClientReq::MakeTableReq(MakeTableReq {
                    options: options.clone(),
                    data: Some(MakeTableData {
                        data: Some(replace(data.clone())),
                    }),
                })),
                ..msg.clone()
            },
            Request {
                client_req:
                    Some(ClientReq::TableUpdateReq(TableUpdateReq {
                        // data,
                        port_id,
                        data:
                            Some(MakeTableData {
                                data: Some(ref data),
                            }),
                    })),
                ..
            } => Request {
                client_req: Some(ClientReq::TableUpdateReq(TableUpdateReq {
                    port_id,
                    data: Some(MakeTableData {
                        data: Some(replace(data.clone())),
                    }),
                })),
                ..msg.clone()
            },
            x => x,
        };

        write!(f, "{}", serde_json::to_string(&msg).unwrap())
    }
}

impl std::fmt::Display for Response {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut msg = self.clone();
        msg = match msg {
            Response {
                client_resp: Some(ClientResp::ViewToColumnsStringResp(_)),
                ..
            } => Response {
                client_resp: Some(ClientResp::ViewToColumnsStringResp(
                    ViewToColumnsStringResp {
                        json_string: "<< redacted >>".to_owned(),
                    },
                )),
                ..msg.clone()
            },
            x => x,
        };

        write!(f, "{}", serde_json::to_string(&msg).unwrap())
    }
}
