////////////////////////////////////////////////////////////////////////////////
//
// Copyright (c) 2018, the Perspective Authors.
//
// This file is part of the Perspective library, distributed under the terms
// of the Apache License 2.0.  The full license can be found in the LICENSE
// file.

use wasm_bindgen_test::*;
use yew::prelude::*;

use crate::components::status_bar_counter::*;
use crate::session::TableStats;
use crate::utils::await_animation_frame;
use crate::*;

wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test]
pub async fn test_counter_none() {
    let div = test_html! {
        <StatusBarRowsCounter stats={ None }>
        </StatusBarRowsCounter>
    };

    assert_eq!(div.inner_html(), "- rows");
}

#[wasm_bindgen_test]
pub async fn test_counter_initializing() {
    let stats = Some(TableStats {
        is_pivot: false,
        num_rows: None,
        virtual_rows: None,
    });

    let div = test_html! {
        <StatusBarRowsCounter stats={ stats }>
        </StatusBarRowsCounter>
    };

    assert_eq!(div.inner_html(), "- rows");
}

#[wasm_bindgen_test]
pub async fn test_counter_some_connected_no_view() {
    let stats = Some(TableStats {
        is_pivot: false,
        num_rows: Some(123456789),
        virtual_rows: None,
    });

    let div = test_html! {
        <StatusBarRowsCounter stats={ stats }>
        </StatusBarRowsCounter>
    };

    assert_eq!(div.inner_html(), "123,456,789 rows");
}

#[wasm_bindgen_test]
pub async fn test_counter_some_connected_no_pivot() {
    let stats = Some(TableStats {
        is_pivot: false,
        num_rows: Some(123456789),
        virtual_rows: Some(54321),
    });

    let div = test_html! {
        <StatusBarRowsCounter stats={ stats }>
        </StatusBarRowsCounter>
    };

    assert_eq!(div.inner_html(), "123,456,789 rows");
}

#[wasm_bindgen_test]
pub async fn test_counter_some_connected_pivot() {
    let stats = Some(TableStats {
        is_pivot: true,
        num_rows: Some(123456789),
        virtual_rows: Some(54321),
    });

    let div = test_html! {
        <StatusBarRowsCounter stats={ stats }>
        </StatusBarRowsCounter>
    };

    assert_eq!(div.inner_html(), "54,321 ");
}
