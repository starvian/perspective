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
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/raw_types.h>
#include <perspective/scalar.h>
#include <perspective/column.h>
#include <boost/algorithm/string.hpp>
#include <type_traits>

#ifdef PSP_ENABLE_WASM
#include <codecvt>
typedef std::codecvt_utf8<wchar_t> utf8convert_type;
typedef std::codecvt_utf8_utf16<wchar_t> utf16convert_type;
#endif

namespace perspective {

/**
 * @brief The `computed_function` namespace contains all functions that will be
 * used to generate values for a computed column. Computed functions should
 * receive a parameter pack of `t_tscalar`s and return a `t_tscalar` value.
 * 
 */
namespace computed_function {

/**
 * @brief Generate headers for numeric computations with one operand.
 */
#define NUMERIC_FUNCTION_1_HEADER(NAME)          \
    t_tscalar NAME##_uint8(t_tscalar uint8);    \
    t_tscalar NAME##_uint16(t_tscalar uint16);   \
    t_tscalar NAME##_uint32(t_tscalar uint32);   \
    t_tscalar NAME##_uint64(t_tscalar uint64);   \
    t_tscalar NAME##_int8(t_tscalar int8);     \
    t_tscalar NAME##_int16(t_tscalar int16);    \
    t_tscalar NAME##_int32(t_tscalar int32);    \
    t_tscalar NAME##_int64(t_tscalar int64);    \
    t_tscalar NAME##_float32(t_tscalar float32);  \
    t_tscalar NAME##_float64(t_tscalar float64);  \

NUMERIC_FUNCTION_1_HEADER(pow);
NUMERIC_FUNCTION_1_HEADER(invert);
NUMERIC_FUNCTION_1_HEADER(sqrt);
NUMERIC_FUNCTION_1_HEADER(abs);
NUMERIC_FUNCTION_1_HEADER(bucket_10);
NUMERIC_FUNCTION_1_HEADER(bucket_100);
NUMERIC_FUNCTION_1_HEADER(bucket_1000);
NUMERIC_FUNCTION_1_HEADER(bucket_0_1);
NUMERIC_FUNCTION_1_HEADER(bucket_0_0_1);
NUMERIC_FUNCTION_1_HEADER(bucket_0_0_0_1);
    
template <t_dtype T>
t_tscalar add(t_tscalar x, t_tscalar y);

template <t_dtype T>
t_tscalar subtract(t_tscalar x, t_tscalar y);

template <t_dtype T>
t_tscalar multiply(t_tscalar x, t_tscalar y);

template <t_dtype T>
t_tscalar divide(t_tscalar x, t_tscalar y);

template <t_dtype T>
t_tscalar percent_of(t_tscalar x, t_tscalar y);

#define NUMERIC_FUNCTION_2_HEADER(NAME)                                    \
    template <> t_tscalar NAME<DTYPE_UINT8>(t_tscalar x, t_tscalar y);     \
    template <> t_tscalar NAME<DTYPE_UINT16>(t_tscalar x, t_tscalar y);    \
    template <> t_tscalar NAME<DTYPE_UINT32>(t_tscalar x, t_tscalar y);    \
    template <> t_tscalar NAME<DTYPE_UINT64>(t_tscalar x, t_tscalar y);    \
    template <> t_tscalar NAME<DTYPE_INT8>(t_tscalar x, t_tscalar y);      \
    template <> t_tscalar NAME<DTYPE_INT16>(t_tscalar x, t_tscalar y);     \
    template <> t_tscalar NAME<DTYPE_INT32>(t_tscalar x, t_tscalar y);     \
    template <> t_tscalar NAME<DTYPE_INT64>(t_tscalar x, t_tscalar y);     \
    template <> t_tscalar NAME<DTYPE_FLOAT32>(t_tscalar x, t_tscalar y);   \
    template <> t_tscalar NAME<DTYPE_FLOAT64>(t_tscalar x, t_tscalar y);   \

NUMERIC_FUNCTION_2_HEADER(add);
NUMERIC_FUNCTION_2_HEADER(subtract);
NUMERIC_FUNCTION_2_HEADER(multiply);
NUMERIC_FUNCTION_2_HEADER(divide);
NUMERIC_FUNCTION_2_HEADER(percent_of);

// String functions
t_tscalar length(t_tscalar x);

// Functions that return a string/write into a string column should not return,
// and instead write directly into the output column. This prevents pointers to
// strings from going out of scope/leaking.
void uppercase(t_tscalar x, std::int32_t idx, std::shared_ptr<t_column> output_column);
void lowercase(t_tscalar x, std::int32_t idx, std::shared_ptr<t_column> output_column);
void concat_space(t_tscalar x, t_tscalar y, std::int32_t idx, std::shared_ptr<t_column> output_column);
void concat_comma(t_tscalar x, t_tscalar y, std::int32_t idx, std::shared_ptr<t_column> output_column);

} // end namespace computed_function
} // end namespace perspective