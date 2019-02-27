/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#include <perspective/first.h>
#include <perspective/exports.h>
#include <perspective/base.h>
#include <perspective/raw_types.h>
#include <perspective/gnode.h>
#include <perspective/pool.h>
#include <perspective/config.h>
#include <perspective/context_zero.h>
#include <perspective/context_one.h>
#include <perspective/context_two.h>
#include <cstddef>
#include <memory>
#include <map>

namespace perspective {

template <typename CTX_T>
class PERSPECTIVE_EXPORT View {
public:
    View(t_pool* pool, std::shared_ptr<CTX_T> ctx, std::int32_t sides,
        std::shared_ptr<t_gnode> gnode, std::string name, std::string separator,
        t_config config);

    void delete_view();

    std::int32_t sides();
    std::int32_t num_rows();
    std::int32_t num_columns();

    std::map<std::string, std::string> schema();
    std::vector<std::string> _column_names(bool skip = false, std::int32_t depth = 0);

    // Pivot table operations
    std::int32_t get_row_expanded(std::int32_t idx);
    t_index expand(std::int32_t idx, std::int32_t row_pivot_length);
    t_index collapse(std::int32_t idx);
    void set_depth(std::int32_t depth, std::int32_t row_pivot_length);

    // Getters
    std::shared_ptr<CTX_T> get_context();
    std::vector<std::string> get_row_pivots();
    std::vector<std::string> get_column_pivots();
    std::vector<t_aggspec> get_aggregates();
    std::vector<t_fterm> get_filters();
    std::vector<t_sortspec> get_sorts();
    bool is_column_only();

private:
    std::string _map_aggregate_types(const std::string& name, const std::string& typestring);

    t_pool* m_pool;
    std::shared_ptr<CTX_T> m_ctx;
    std::int32_t m_nsides;
    std::shared_ptr<t_gnode> m_gnode;
    std::string m_name;
    std::string m_separator;

    std::vector<std::string> m_row_pivots;
    std::vector<std::string> m_column_pivots;
    std::vector<t_aggspec> m_aggregates;
    std::vector<t_fterm> m_filters;
    std::vector<t_sortspec> m_sorts;
    bool m_column_only;

    t_config m_config;
};
} // end namespace perspective
