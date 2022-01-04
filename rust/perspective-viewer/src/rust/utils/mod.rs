////////////////////////////////////////////////////////////////////////////////
//
// Copyright (c) 2018, the Perspective Authors.
//
// This file is part of the Perspective library, distributed under the terms
// of the Apache License 2.0.  The full license can be found in the LICENSE
// file.

mod async_callback;
mod closure;
mod datetime;
mod debounce;
mod errors;
mod future_to_promise;
mod js_object;
mod pubsub;
mod request_animation_frame;
mod testing;
mod weak_scope;

#[cfg(test)]
mod tests;

pub use self::async_callback::*;
pub use self::closure::*;
pub use self::datetime::*;
pub use self::debounce::*;
pub use self::errors::*;
pub use self::future_to_promise::*;
pub use self::pubsub::*;
pub use self::request_animation_frame::*;
pub use self::testing::*;
pub use self::weak_scope::*;

#[macro_export]
macro_rules! maybe {
    ($($exp:stmt);*) => {{
        #[must_use]
        let x = (|| {
            $(
                $exp
            )*
        })();
        x
    }};
}

/// A helper to for the pattern `let x2 = x;` necessary to clone structs destined
/// for an `async` or `'static` closure stack.  This is like `move || { .. }` or
/// `move async { .. }`, but for clone semantics.
#[macro_export]
macro_rules! clone {
    ($($x:ident : $y:ident),*) => {
        $(let $x = $y.clone();)*
    };
    ($($x:ident),*) => {
        $(let $x = $x.clone();)*
    };
}
