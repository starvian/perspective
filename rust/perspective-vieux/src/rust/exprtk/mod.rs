/////////////////////////////////////////////////////////, kind: (), insert_text: (), insert_text_rules: (), documentation: () ///////////////////////
//
// Copyright (c) 2018, the Perspective Authors.
//
// This file is part of the Perspective library, distributed under the terms
// of the Apache License 2.0.  The full license can be found in the LICENSE
// file.

mod language;
mod completions;
mod init;

use crate::utils::monaco::*;

use init::*;
use language::*;
use serde_json::error;
use wasm_bindgen::JsCast;

/// Configure `monaco` for a set of column names, such that intellisense may complete
/// available columns.  In the interest of simplification, this uses a static `RefCell`
/// which must be set prior to completion events;  this is currently valid as
/// an expression editor must have focus which is exclusive.  If we ever wanted to
/// support multiple open expression editors at once on a page, this will need to
/// become a struct, with a new language instance and expression editor custom element
/// per viewer.
///
/// # Arguments
/// * `names` - a vector of owned names for the `View()` with page focus.
pub fn set_global_completion_column_names(names: Vec<String>) {
    COMPLETION_COLUMN_NAMES.with(|x| {
        *x.borrow_mut() = names;
    });
}

/// Initialize the `ExprTK` language in `monaco`.  This should only be done once.
/// 
/// # Arguments
/// `base` - the `monaco-editor` base theme name.
pub async fn init_monaco(base: &str) -> Result<Editor, error::Error> {
    if IS_REGISTERED.with(|x| !x.get()) {
        let editor = init_language(base).await?;
        init_environment()?;
        IS_REGISTERED.with(|x| x.set(true));
        Ok(editor)
    } else {
        Ok(monaco_module()
            .await
            .unchecked_into::<MonacoModule>()
            .editor())
    }
}