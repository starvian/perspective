////////////////////////////////////////////////////////////////////////////////
//
// Copyright (c) 2018, the Perspective Authors.
//
// This file is part of the Perspective library, distributed under the terms
// of the Apache License 2.0.  The full license can be found in the LICENSE
// file.

use super::containers::dropdown::*;
use crate::config::*;
use crate::renderer::*;
use crate::session::*;
use crate::*;

use yew::prelude::*;

#[derive(Properties, Clone)]
pub struct AggregateSelectorProps {
    pub column: String,
    pub aggregate: Option<Aggregate>,
    pub renderer: Renderer,
    pub session: Session,
}

derive_renderable_props!(AggregateSelectorProps);

impl PartialEq for AggregateSelectorProps {
    fn eq(&self, _rhs: &Self) -> bool {
        false
    }
}

pub enum AggregateSelectorMsg {
    SetAggregate(Aggregate),
}

pub struct AggregateSelector {
    aggregates: Vec<DropDownItem<Aggregate>>,
    aggregate: Option<Aggregate>,
}

impl Component for AggregateSelector {
    type Message = AggregateSelectorMsg;
    type Properties = AggregateSelectorProps;

    fn create(ctx: &Context<Self>) -> Self {
        let mut selector = AggregateSelector {
            aggregates: vec![],
            aggregate: ctx.props().aggregate.clone(),
        };

        selector.aggregates = selector.get_dropdown_aggregates(ctx);
        selector
    }

    fn update(&mut self, ctx: &Context<Self>, msg: Self::Message) -> bool {
        match msg {
            AggregateSelectorMsg::SetAggregate(aggregate) => {
                self.set_aggregate(ctx, aggregate);
                false
            }
        }
    }

    fn changed(&mut self, ctx: &Context<Self>) -> bool {
        self.aggregates = self.get_dropdown_aggregates(ctx);
        true
    }

    fn view(&self, ctx: &Context<Self>) -> Html {
        let callback = ctx.link().callback(AggregateSelectorMsg::SetAggregate);
        let selected_agg = ctx
            .props()
            .aggregate
            .clone()
            .or_else(|| {
                ctx.props()
                    .session
                    .metadata()
                    .get_column_table_type(&ctx.props().column)
                    .map(|x| x.default_aggregate())
            })
            .unwrap();

        let values = self.aggregates.clone();

        html! {
            <div class="aggregate-selector-wrapper">
                <DropDown<Aggregate>
                    class={ "aggregate-selector" }
                    values={ values }
                    selected={ selected_agg }
                    on_select={ callback }>

                </DropDown<Aggregate>>
            </div>
        }
    }
}

impl AggregateSelector {
    pub fn set_aggregate(&mut self, ctx: &Context<Self>, aggregate: Aggregate) {
        self.aggregate = Some(aggregate.clone());
        let ViewConfig { mut aggregates, .. } = ctx.props().session.get_view_config();
        aggregates.insert(ctx.props().column.clone(), aggregate);
        ctx.props().update_and_render(ViewConfigUpdate {
            aggregates: Some(aggregates),
            ..ViewConfigUpdate::default()
        });
    }

    pub fn get_dropdown_aggregates(
        &self,
        ctx: &Context<Self>,
    ) -> Vec<DropDownItem<Aggregate>> {
        let aggregates = ctx
            .props()
            .session
            .metadata()
            .get_column_aggregates(&ctx.props().column)
            .expect("Bad Aggs")
            .collect::<Vec<_>>();

        let multi_aggregates = aggregates
            .iter()
            .filter(|x| matches!(x, Aggregate::MultiAggregate(_, _)))
            .cloned()
            .collect::<Vec<_>>();

        let multi_aggregates2 = if !multi_aggregates.is_empty() {
            vec![DropDownItem::OptGroup("weighted mean", multi_aggregates)]
        } else {
            vec![]
        };

        let s = aggregates
            .iter()
            .filter(|x| matches!(x, Aggregate::SingleAggregate(_)))
            .cloned()
            .map(DropDownItem::Option)
            .chain(multi_aggregates2);

        s.collect::<Vec<_>>()
    }
}
