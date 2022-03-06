////////////////////////////////////////////////////////////////////////////////
//
// Copyright (c) 2018, the Perspective Authors.
//
// This file is part of the Perspective library, distributed under the terms
// of the Apache License 2.0.  The full license can be found in the LICENSE
// file.

use crate::js::perspective::*;
use crate::*;

use super::view::*;

use js_sys::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

/// Download a flat (unpivoted with all columns) CSV.
pub async fn download_csv_flat(table: &JsPerspectiveTable) -> Result<(), JsValue> {
    let view = table.view(&js_object!().unchecked_into()).await?;
    download_csv_async(&view).await?;
    view.delete().await
}

/// Download a CSV
pub async fn download_csv(view: &View) -> Result<(), JsValue> {
    download_csv_async(view).await
}

/// Download a CSV, but not a `Promise`.  Used to implement the public methods.
async fn download_csv_async(view: &JsPerspectiveView) -> Result<(), JsValue> {
    let csv_fut = view.to_csv(js_object!("formatted", true));
    let window = web_sys::window().unwrap();
    let document = window.document().unwrap();
    let element: web_sys::HtmlElement = document.create_element("a")?.unchecked_into();
    let blob_url = {
        let csv = csv_fut.await.unwrap();
        let csv_str = csv.as_string().unwrap();
        let bytes = csv_str.as_bytes();
        let array = unsafe { [Uint8Array::view(bytes)].iter().collect::<Array>() };
        let blob = web_sys::Blob::new_with_u8_array_sequence(&array)?;
        web_sys::Url::create_object_url_with_blob(&blob)?
    };

    element.set_attribute("download", "perspective.csv")?;
    element.set_attribute("href", &blob_url)?;
    element.style().set_property("display", "none")?;
    document.body().unwrap().append_child(&element)?;
    element.click();
    document.body().unwrap().remove_child(&element)?;
    Ok(())
}

/// Download a flat (unpivoted with all columns) Arrow.
pub async fn download_arrow_flat(table: &JsPerspectiveTable) -> Result<(), JsValue> {
    let view = table.view(&js_object!().unchecked_into()).await?;
    download_arrow_async(&view).await?;
    view.delete().await
}

/// Download an Apache Arrow
pub async fn download_arrow(view: &View) -> Result<(), JsValue> {
    download_arrow_async(view).await
}

/// Download a CSV, but not a `Promise`.  Used to implement the public methods.
async fn download_arrow_async(view: &JsPerspectiveView) -> Result<(), JsValue> {
    let csv_fut = view.to_arrow();
    let window = web_sys::window().unwrap();
    let document = window.document().unwrap();
    let element: web_sys::HtmlElement = document.create_element("a")?.unchecked_into();
    let blob_url = {
        let bytes = csv_fut.await.unwrap();
        let array = [Uint8Array::new(&bytes)].iter().collect::<Array>();
        let blob = web_sys::Blob::new_with_u8_array_sequence(&array)?;
        web_sys::Url::create_object_url_with_blob(&blob)?
    };

    element.set_attribute("download", "perspective.arrow")?;
    element.set_attribute("href", &blob_url)?;
    element.style().set_property("display", "none")?;
    document.body().unwrap().append_child(&element)?;
    element.click();
    document.body().unwrap().remove_child(&element)?;
    Ok(())
}
