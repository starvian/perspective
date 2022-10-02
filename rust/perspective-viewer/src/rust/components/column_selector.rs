////////////////////////////////////////////////////////////////////////////////
//
// Copyright (c) 2018, the Perspective Authors.
//
// This file is part of the Perspective library, distributed under the terms
// of the Apache License 2.0.  The full license can be found in the LICENSE
// file.

mod active_column;
mod aggregate_selector;
mod expression_toolbar;
mod inactive_column;

use std::iter::*;
use std::rc::Rc;

use extend::ext;
use wasm_bindgen::prelude::*;
use web_sys::*;
use yew::prelude::*;

use self::active_column::*;
use self::inactive_column::*;
use super::containers::scroll_panel::*;
use super::style::LocalStyle;
use crate::config::*;
use crate::custom_elements::expression_editor::ExpressionEditorElement;
use crate::dragdrop::*;
use crate::model::*;
use crate::renderer::*;
use crate::session::*;
use crate::utils::*;
use crate::*;

#[derive(Properties)]
pub struct ColumnSelectorProps {
    pub session: Session,
    pub renderer: Renderer,
    pub dragdrop: DragDrop,

    #[prop_or_default]
    pub on_resize: Option<Rc<PubSub<()>>>,

    #[prop_or_default]
    pub on_dimensions_reset: Option<Rc<PubSub<()>>>,
}

derive_model!(DragDrop, Renderer, Session for ColumnSelectorProps);

impl ColumnSelectorProps {
    fn save_expr(&self, expression: &JsValue) -> ApiFuture<()> {
        let expression = expression.as_string().unwrap();
        let mut expressions = self.session.get_view_config().expressions.clone();
        expressions.retain(|x| x != &expression);
        expressions.push(expression);
        self.update_and_render(ViewConfigUpdate {
            expressions: Some(expressions),
            ..ViewConfigUpdate::default()
        })
    }
}

impl PartialEq for ColumnSelectorProps {
    fn eq(&self, _rhs: &ColumnSelectorProps) -> bool {
        true
    }
}

#[derive(Debug)]
pub enum ColumnSelectorMsg {
    TableLoaded,
    ViewCreated,
    HoverActiveIndex(Option<usize>),
    Drag(DragEffect),
    DragEnd,
    Drop((String, DragTarget, DragEffect, usize)),
    OpenExpressionEditor(bool),
    SaveExpression(JsValue),
}

use ColumnSelectorMsg::*;

/// A `ColumnSelector` controls the `columns` field of the `ViewConfig`,
/// deriving its options from the table columns and `ViewConfig` expressions.
pub struct ColumnSelector {
    _subscriptions: [Subscription; 5],
    add_expression_ref: NodeRef,
    named_row_count: usize,
    expression_editor: Option<ExpressionEditorElement>,
    drag_container: DragDropContainer,
}

impl Component for ColumnSelector {
    type Message = ColumnSelectorMsg;
    type Properties = ColumnSelectorProps;

    fn create(ctx: &Context<Self>) -> Self {
        let table_sub = {
            let cb = ctx.link().callback(|_| ColumnSelectorMsg::TableLoaded);
            ctx.props().session.table_loaded.add_listener(cb)
        };

        let view_sub = {
            let cb = ctx.link().callback(|_| ColumnSelectorMsg::ViewCreated);
            ctx.props().session.view_created.add_listener(cb)
        };

        let drop_sub = {
            let cb = ctx.link().callback(ColumnSelectorMsg::Drop);
            ctx.props().dragdrop.drop_received.add_listener(cb)
        };

        let drag_sub = {
            let cb = ctx.link().callback(ColumnSelectorMsg::Drag);
            ctx.props().dragdrop.dragstart_received.add_listener(cb)
        };

        let dragend_sub = {
            let cb = ctx.link().callback(|_| ColumnSelectorMsg::DragEnd);
            ctx.props().dragdrop.dragend_received.add_listener(cb)
        };

        let named = maybe! {
            let plugin =
                ctx.props().renderer.get_active_plugin().ok()?;

            Some(plugin.config_column_names()?.length() as usize)
        };

        let named_row_count = named.unwrap_or_default();

        let drag_container = DragDropContainer::new(|| {}, {
            let link = ctx.link().clone();
            move || link.send_message(ColumnSelectorMsg::HoverActiveIndex(None))
        });

        ColumnSelector {
            _subscriptions: [table_sub, view_sub, drop_sub, drag_sub, dragend_sub],
            add_expression_ref: NodeRef::default(),
            expression_editor: None,
            named_row_count,
            drag_container,
        }
    }

    fn update(&mut self, ctx: &Context<Self>, msg: Self::Message) -> bool {
        match msg {
            Drag(DragEffect::Move(DragTarget::Active)) => false,
            Drag(_) => true,
            DragEnd => true,
            TableLoaded => true,
            ViewCreated => {
                let named = maybe! {
                    let plugin =
                        ctx.props().renderer.get_active_plugin().ok()?;

                    Some(plugin.config_column_names()?.length() as usize)
                };

                self.named_row_count = named.unwrap_or_default();
                true
            }
            HoverActiveIndex(Some(to_index)) => {
                let min_cols = ctx.props().renderer.metadata().min;
                let config = ctx.props().session.get_view_config();
                let is_to_empty = !config
                    .columns
                    .get(to_index)
                    .map(|x| x.is_some())
                    .unwrap_or_default();

                let from_index = ctx
                    .props()
                    .dragdrop
                    .get_drag_column()
                    .and_then(|x| config.columns.iter().position(|z| z.as_ref() == Some(&x)));

                if min_cols
                    .and_then(|x| from_index.map(|from_index| from_index < x))
                    .unwrap_or_default()
                    && is_to_empty
                    || from_index
                        .map(|from_index| {
                            from_index == config.columns.len() - 1 && to_index > from_index
                        })
                        .unwrap_or_default()
                {
                    ctx.props().dragdrop.drag_leave(DragTarget::Active);
                    true
                } else {
                    ctx.props()
                        .dragdrop
                        .drag_enter(DragTarget::Active, to_index)
                }
            }
            HoverActiveIndex(_) => {
                ctx.props().dragdrop.drag_leave(DragTarget::Active);
                true
            }
            Drop((column, DragTarget::Active, effect, index)) => {
                let update = ctx.props().session.create_drag_drop_update(
                    column,
                    index,
                    DragTarget::Active,
                    effect,
                    &ctx.props().renderer.metadata(),
                );

                ApiFuture::spawn(ctx.props().update_and_render(update));
                true
            }
            Drop((_, _, DragEffect::Move(DragTarget::Active), _)) => true,
            Drop((..)) => true,
            SaveExpression(expression) => {
                let task = ctx.props().save_expr(&expression);
                let expr = self.expression_editor.clone();
                ApiFuture::spawn(async move {
                    task.await?;
                    if let Some(editor) = expr.as_ref() {
                        editor.hide().unwrap_or_default();
                        editor.reset_empty_expr();
                    }

                    Ok(())
                });

                false
            }
            OpenExpressionEditor(reset) => {
                if reset {
                    self.expression_editor = None;
                }

                let target = self.add_expression_ref.cast::<HtmlElement>().unwrap();
                let expression_editor = self
                    .expression_editor
                    .get_or_insert_with(|| ctx.create_expression_editor());

                expression_editor.open(target);
                false
            }
        }
    }

    fn view(&self, ctx: &Context<Self>) -> Html {
        if let Some(all_columns) = ctx.props().session.metadata().get_table_columns() {
            let config = ctx.props().session.get_view_config();
            let is_pivot = config.is_aggregated();
            let columns_iter = ctx.props().column_selector_iter_set(&config);

            let dragover = Callback::from(|_event: DragEvent| _event.prevent_default());
            let ondragenter = ctx.link().callback(HoverActiveIndex);

            let drop = Callback::from({
                let dragdrop = ctx.props().dragdrop.clone();
                move |_| dragdrop.notify_drop()
            });

            let ondragend = Callback::from({
                let dragdrop = ctx.props().dragdrop.clone();
                move |_event| dragdrop.drag_end()
            });

            let add_expression = ctx.link().callback(|event: MouseEvent| {
                ColumnSelectorMsg::OpenExpressionEditor(event.shift_key())
            });

            let onselect = ctx.link().callback(|()| ViewCreated);
            let mut active_classes = classes!();
            if ctx.props().dragdrop.get_drag_column().is_some() {
                active_classes.push("dragdrop-highlight");
            };

            if config.columns.iter().filter(|x| x.is_some()).count()
                != all_columns.len() + config.expressions.len()
            {
                active_classes.push("collapse");
            }

            let active_columns = columns_iter.active().enumerate().map(|(idx, name)| {
                clone!(
                    ctx.props().dragdrop,
                    ctx.props().renderer,
                    ctx.props().session,
                    // ondragenter,
                    ondragend,
                    onselect
                );

                let ondragenter = ondragenter.reform(move |event: DragEvent| {
                    // Safari does not set `relatedTarget` so this event must be allowed to
                    // bubble so we can count entry/exit stacks to determine true
                    // `"dragleave"`.
                    if event.related_target().is_some() {
                        event.stop_propagation();
                        event.prevent_default();
                    }

                    Some(idx)
                });

                ActiveColumnProps {
                    idx,
                    name,
                    dragdrop,
                    session,
                    renderer,
                    ondragenter,
                    ondragend,
                    onselect,
                    is_pivot,
                }
            });

            let expression_columns =
                columns_iter
                    .expression()
                    .enumerate()
                    .map(|(idx, vc)| InactiveColumnProps {
                        idx,
                        visible: vc.is_visible,
                        name: vc.name.to_owned(),
                        dragdrop: ctx.props().dragdrop.clone(),
                        session: ctx.props().session.clone(),
                        renderer: ctx.props().renderer.clone(),
                        onselect: onselect.clone(),
                        ondragend: ondragend.clone(),
                    });

            let inactive_columns =
                columns_iter
                    .inactive()
                    .enumerate()
                    .map(|(idx, vc)| InactiveColumnProps {
                        idx,
                        visible: vc.is_visible,
                        name: vc.name.to_owned(),
                        dragdrop: ctx.props().dragdrop.clone(),
                        session: ctx.props().session.clone(),
                        renderer: ctx.props().renderer.clone(),
                        onselect: onselect.clone(),
                        ondragend: ondragend.clone(),
                    });

            // let dragenter = dragenter_helper(dragleave_ref.clone());

            html_template! {
                <LocalStyle href={ css!("column-selector") } />
                <ScrollPanel<ActiveColumnProps>
                    id="active-columns"
                    class={ active_classes }
                    dragover={ dragover }
                    dragenter={ &self.drag_container.dragenter }
                    dragleave={ &self.drag_container.dragleave }
                    viewport_ref={ &self.drag_container.noderef }
                    drop={ drop }
                    on_resize={ &ctx.props().on_resize }
                    on_dimensions_reset={ &ctx.props().on_dimensions_reset }
                    items={ Rc::new(active_columns.collect::<Vec<_>>()) }
                    named_row_count={ self.named_row_count }
                    named_row_height={ if is_pivot { 62.0 } else { 42.0 } }
                    row_height={ if is_pivot { 40.0 } else { 20.0 } }>
                </ScrollPanel<ActiveColumnProps>>
                <div id="sub-columns">
                    <ScrollPanel<InactiveColumnProps>
                        id="expression-columns"
                        items={ Rc::new(expression_columns.collect::<Vec<_>>()) }
                        on_dimensions_reset={ &ctx.props().on_dimensions_reset }
                        row_height={ 20.0 }>
                    </ScrollPanel<InactiveColumnProps>>
                    <ScrollPanel<InactiveColumnProps>
                        id="inactive-columns"
                        on_dimensions_reset={ &ctx.props().on_dimensions_reset }
                        items={ Rc::new(inactive_columns.collect::<Vec<_>>()) }
                        row_height={ 20.0 }>
                    </ScrollPanel<InactiveColumnProps>>
                </div>
                <div
                    id="add-expression"
                    class="side_panel-action"
                    ref={ &self.add_expression_ref }
                    onmousedown={ add_expression }>

                    <span class="psp-icon psp-icon__add"></span>
                    <span class="psp-title__columnName">{ "New Column" }</span>
                </div>
            }
        } else {
            html! {}
        }
    }
}

#[ext]
impl Context<ColumnSelector> {
    /// Create a new `ExpressionEditorElement`.  Used for lazy instantiation,
    /// as creating this element will ultimately download `monaco` which is
    /// very large.
    fn create_expression_editor(&self) -> ExpressionEditorElement {
        let on_save = self.link().callback(SaveExpression);
        ExpressionEditorElement::new(self.props().session.clone(), on_save, None)
    }
}
