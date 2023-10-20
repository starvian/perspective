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

use itertools::Itertools;
use yew::{function_component, html, Callback, Html, Properties};

use crate::components::containers::select::{Select, SelectItem};
use crate::config::plugin::Symbol;

#[derive(Properties, PartialEq)]
pub struct SymbolSelectorProps {
    pub index: usize,
    pub selected_value: Option<String>,
    pub values: Vec<Symbol>,
    pub callback: Callback<Symbol>,
}

#[function_component(SymbolSelector)]
pub fn symbol_selector(p: &SymbolSelectorProps) -> Html {
    let values = p
        .values
        .clone()
        .into_iter()
        .map(SelectItem::Option)
        .collect_vec();

    let selected = p
        .values
        .iter()
        .find(|sym| {
            p.selected_value
                .as_ref()
                .map(|selected| sym.name == *selected)
                .unwrap_or_default()
        })
        .cloned()
        .unwrap_or_else(|| p.values.get(p.index % values.len()).cloned().unwrap());

    html! {
        // TODO: This probably should be a modal with a preview of the SVG symbol
        <Select<Symbol>
            wrapper_class="symbol-selector-wrapper"
            class="symbol-selector"
            { values }
            { selected }
            on_select={ p.callback.clone() }/>
    }
}
