/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/computed.h>

namespace perspective {

//t_computation::t_computation() {}

t_computed_column_def::t_computed_column_def(
    const std::string& column_name,
    const std::vector<std::string> input_columns,
    const t_computation& computation)
    : m_column_name(column_name)
    , m_input_columns(input_columns)
    , m_computation(computation) {}

t_computation
t_computed_column::get_computation(
    t_computation_method_name name, const std::vector<t_dtype>& input_types) {
    for (const t_computation& computation : t_computed_column::computations) {
        if (computation.m_name == name && computation.m_input_type_1 == input_types[0] && computation.m_input_type_2 == input_types[1]) {
            return computation;
        }
    }
    PSP_COMPLAIN_AND_ABORT("Could not find computation.");
};

void
t_computed_column::apply_computation(
    const std::vector<std::shared_ptr<t_column>>& table_columns,
    const std::vector<std::shared_ptr<t_column>>& flattened_columns,
    std::shared_ptr<t_column> output_column,
    const std::vector<t_rlookup>& row_indices,
    const t_computation& computation) {
    std::uint32_t end = row_indices.size();
    if (end == 0) {
        end = flattened_columns[0]->size();
    }
    auto arity = table_columns.size();

    for (t_uindex idx = 0; idx < end; ++idx) {
        // iterate through row indices OR through all rows
        t_uindex ridx = idx;
        if (row_indices.size() > 0) {
            ridx = row_indices[idx].m_idx;
        }

        // create args
        std::vector<t_tscalar> args;
        for (t_uindex x = 0; x < arity; ++x) {
            t_tscalar t = flattened_columns[x]->get_scalar(idx);
            if (!t.is_valid()) {
                t = table_columns[x]->get_scalar(ridx);
                if (!t.is_valid()) {
                    break;
                }
            }

            args.push_back(t);
        }


        if (args[0].is_none() || args[1].is_none()) {
            output_column->set_scalar(idx, mknone());
            output_column->set_valid(idx, false);
            continue;
        }

        t_tscalar rval;

        switch (computation.m_name) {
            case ADD: {
                rval = computed_method::add(args[0], args[1]);
            } break;
            case SUBTRACT: {
                rval = computed_method::subtract(args[0], args[1]);
            } break;
            case MULTIPLY: {
                rval = computed_method::multiply(args[0], args[1]);
            } break;
            case DIVIDE: {
                rval = computed_method::divide(args[0], args[1]);
            } break;
            default: {
                PSP_COMPLAIN_AND_ABORT("Invalid computation method");
            }
        }

        output_column->set_scalar(idx, rval);

        if (rval.is_none()) {
            output_column->set_valid(idx, false);
        }
    }

    output_column->pprint();
}

std::vector<t_computation> t_computed_column::computations = {};

void t_computed_column::make_computations() {
    std::vector<t_dtype> dtypes = {DTYPE_FLOAT64, DTYPE_FLOAT32, DTYPE_INT64, DTYPE_INT32, DTYPE_INT16, DTYPE_INT8, DTYPE_UINT64, DTYPE_UINT32, DTYPE_UINT16, DTYPE_UINT8};
    std::vector<t_computation_method_name> methods = {ADD, SUBTRACT, MULTIPLY, DIVIDE};

    for (const auto method : methods) {
        for (auto i = 0; i < dtypes.size(); ++i) {
            for (auto j = 0; j < dtypes.size(); ++j) {
                t_dtype return_type = DTYPE_INT64;

                if (method == DIVIDE || (is_floating_point(dtypes[i]) || is_floating_point(dtypes[j]))) {
                    return_type = DTYPE_FLOAT64;
                };

                t_computed_column::computations.push_back(
                    t_computation{dtypes[i], dtypes[j], return_type, method}
                );
            }
        }
    }
}

} // end namespace perspective