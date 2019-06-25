/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/emscripten.h>

using namespace emscripten;
using namespace perspective;

namespace perspective {
namespace binding {
    /******************************************************************************
     *
     * Utility
     */
    template <>
    bool
    hasValue(t_val item) {
        return (!item.isUndefined() && !item.isNull());
    }

    /******************************************************************************
     *
     * Data Loading
     */

    t_index
    _get_aggregate_index(const std::vector<std::string>& agg_names, std::string name) {
        auto it = std::find(agg_names.begin(), agg_names.end(), name);
        if (it != agg_names.end()) {
            return t_index(std::distance(agg_names.begin(), it));
        }
        return t_index();
    }

    std::vector<std::string>
    _get_aggregate_names(const std::vector<t_aggspec>& aggs) {
        std::vector<std::string> names;
        for (const t_aggspec& agg : aggs) {
            names.push_back(agg.name());
        }
        return names;
    }

    template <>
    std::vector<t_aggspec>
    _get_aggspecs(const t_schema& schema, const std::vector<std::string>& row_pivots,
        const std::vector<std::string>& column_pivots, bool column_only,
        const std::vector<std::string>& columns, const std::vector<t_val>& sortbys,
        t_val j_aggs) {
        std::vector<t_aggspec> aggspecs;
        t_val agg_columns = t_val::global("Object").call<t_val>("keys", j_aggs);
        std::vector<std::string> aggs = vecFromArray<t_val, std::string>(agg_columns);

        /**
         * Provide aggregates for columns that are shown but NOT specified in
         * the `j_aggs` object.
         */
        for (const std::string& column : columns) {
            if (std::find(aggs.begin(), aggs.end(), column) != aggs.end()) {
                continue;
            }

            t_dtype dtype = schema.get_dtype(column);
            std::vector<t_dep> dependencies{t_dep(column, DEPTYPE_COLUMN)};
            t_aggtype agg_op
                = t_aggtype::AGGTYPE_ANY; // use aggtype here since we are not parsing aggs

            if (!column_only) {
                agg_op = _get_default_aggregate(dtype);
            }

            aggspecs.push_back(t_aggspec(column, agg_op, dependencies));
        }

        // Construct aggregates from config object
        for (const std::string& agg_column : aggs) {
            if (std::find(columns.begin(), columns.end(), agg_column) == columns.end()) {
                continue;
            }

            std::string agg_op = j_aggs[agg_column].as<std::string>();
            std::vector<t_dep> dependencies;

            if (column_only) {
                agg_op = "any";
            }

            dependencies.push_back(t_dep(agg_column, DEPTYPE_COLUMN));

            t_aggtype aggtype = str_to_aggtype(agg_op);

            if (aggtype == AGGTYPE_FIRST || aggtype == AGGTYPE_LAST) {
                if (dependencies.size() == 1) {
                    dependencies.push_back(t_dep("psp_pkey", DEPTYPE_COLUMN));
                }
                aggspecs.push_back(t_aggspec(
                    agg_column, agg_column, aggtype, dependencies, SORTTYPE_ASCENDING));
            } else {
                aggspecs.push_back(t_aggspec(agg_column, aggtype, dependencies));
            }
        }

        // construct aggspecs for hidden sorts
        for (auto sortby : sortbys) {
            std::string column = sortby[0].as<std::string>();

            bool is_hidden_column
                = std::find(columns.begin(), columns.end(), column) == columns.end();
            bool not_aggregated = std::find(aggs.begin(), aggs.end(), column) == aggs.end();

            if (is_hidden_column) {
                bool is_pivot = (std::find(row_pivots.begin(), row_pivots.end(), column)
                                    != row_pivots.end())
                    || (std::find(column_pivots.begin(), column_pivots.end(), column)
                           != column_pivots.end());

                std::vector<t_dep> dependencies{t_dep(column, DEPTYPE_COLUMN)};
                t_aggtype agg_op;

                if (is_pivot || row_pivots.size() == 0 || column_only) {
                    agg_op = t_aggtype::AGGTYPE_ANY;
                } else {
                    t_dtype dtype = schema.get_dtype(column);
                    agg_op = _get_default_aggregate(dtype);
                }

                aggspecs.push_back(t_aggspec(column, agg_op, dependencies));
            }
        }

        return aggspecs;
    }

    template <>
    std::vector<t_sortspec>
    _get_sort(const std::vector<std::string>& columns, bool is_column_sort,
        const std::vector<t_val>& sortbys) {
        std::vector<t_sortspec> svec{};

        auto _is_valid_sort = [is_column_sort](t_val sort_item) {
            /**
             * If column sort, make sure string matches. Otherwise make
             * sure string is *not* a column sort.
             */
            std::string op = sort_item[1].as<std::string>();
            bool is_col_sortop = op.find("col") != std::string::npos;
            return (is_column_sort && is_col_sortop) || (!is_col_sortop && !is_column_sort);
        };

        for (auto idx = 0; idx < sortbys.size(); ++idx) {
            t_val sort_item = sortbys[idx];
            t_index agg_index;
            std::string column;
            t_sorttype sorttype;

            std::string sort_op_str;
            if (!_is_valid_sort(sort_item)) {
                continue;
            }

            column = sort_item[0].as<std::string>();
            sort_op_str = sort_item[1].as<std::string>();
            sorttype = str_to_sorttype(sort_op_str);

            agg_index = _get_aggregate_index(columns, column);

            svec.push_back(t_sortspec(agg_index, sorttype));
        }
        return svec;
    }

    template <>
    std::vector<t_fterm>
    _get_fterms(const t_schema& schema, t_val j_date_parser, t_val j_filters) {
        std::vector<t_fterm> fvec{};
        std::vector<t_val> filters = vecFromArray<t_val, t_val>(j_filters);

        auto _is_valid_filter = [j_date_parser](t_dtype type, std::vector<t_val> filter) {
            if (type == DTYPE_DATE || type == DTYPE_TIME) {
                t_val parsed_date = j_date_parser.call<t_val>("parse", filter[2]);
                return hasValue(parsed_date);
            } else {
                return hasValue(filter[2]);
            }
        };

        for (auto fidx = 0; fidx < filters.size(); ++fidx) {
            std::vector<t_val> filter = vecFromArray<t_val, t_val>(filters[fidx]);
            std::string col = filter[0].as<std::string>();
            t_filter_op comp = str_to_filter_op(filter[1].as<std::string>());

            // check validity and if_date
            t_dtype col_type = schema.get_dtype(col);
            bool is_valid = _is_valid_filter(col_type, filter);

            if (!is_valid) {
                continue;
            }

            switch (comp) {
                case FILTER_OP_NOT_IN:
                case FILTER_OP_IN: {
                    std::vector<t_tscalar> terms{};
                    std::vector<std::string> j_terms
                        = vecFromArray<t_val, std::string>(filter[2]);
                    for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                        terms.push_back(mktscalar(get_interned_cstr(j_terms[jidx].c_str())));
                    }
                    fvec.push_back(t_fterm(col, comp, mktscalar(0), terms));
                } break;
                default: {
                    t_tscalar term;
                    switch (col_type) {
                        case DTYPE_INT32: {
                            term = mktscalar(filter[2].as<std::int32_t>());
                        } break;
                        case DTYPE_INT64:
                        case DTYPE_FLOAT64: {
                            term = mktscalar(filter[2].as<double>());
                        } break;
                        case DTYPE_BOOL: {
                            term = mktscalar(filter[2].as<bool>());
                        } break;
                        case DTYPE_DATE: {
                            t_val parsed_date = j_date_parser.call<t_val>("parse", filter[2]);
                            term = mktscalar(jsdate_to_t_date(parsed_date));
                        } break;
                        case DTYPE_TIME: {
                            t_val parsed_date = j_date_parser.call<t_val>("parse", filter[2]);
                            term = mktscalar(t_time(static_cast<std::int64_t>(
                                parsed_date.call<t_val>("getTime").as<double>())));
                        } break;
                        default: {
                            term = mktscalar(
                                get_interned_cstr(filter[2].as<std::string>().c_str()));
                        }
                    }

                    fvec.push_back(t_fterm(col, comp, term, std::vector<t_tscalar>()));
                }
            }
        }
        return fvec;
    }

    /******************************************************************************
     *
     * Date Parsing
     */

    t_date
    jsdate_to_t_date(t_val date) {
        return t_date(date.call<t_val>("getFullYear").as<std::int32_t>(),
            date.call<t_val>("getMonth").as<std::int32_t>(),
            date.call<t_val>("getDate").as<std::int32_t>());
    }

    t_val
    t_date_to_jsdate(t_date date) {
        t_val jsdate = t_val::global("Date").new_();
        jsdate.call<t_val>("setYear", date.year());
        jsdate.call<t_val>("setMonth", date.month());
        jsdate.call<t_val>("setDate", date.day());
        jsdate.call<t_val>("setHours", 0);
        jsdate.call<t_val>("setMinutes", 0);
        jsdate.call<t_val>("setSeconds", 0);
        jsdate.call<t_val>("setMilliseconds", 0);
        return jsdate;
    }

    /******************************************************************************
     *
     * Manipulate scalar values
     */
    t_val
    scalar_to_val(const t_tscalar& scalar, bool cast_double, bool cast_string) {
        if (!scalar.is_valid()) {
            return t_val::null();
        }
        switch (scalar.get_dtype()) {
            case DTYPE_BOOL: {
                if (scalar) {
                    return t_val(true);
                } else {
                    return t_val(false);
                }
            }
            case DTYPE_TIME: {
                if (cast_double) {
                    auto x = scalar.to_uint64();
                    double y = *reinterpret_cast<double*>(&x);
                    return t_val(y);
                } else if (cast_string) {
                    double ms = scalar.to_double();
                    t_val date = t_val::global("Date").new_(ms);
                    return date.call<t_val>("toLocaleString");
                } else {
                    return t_val(scalar.to_double());
                }
            }
            case DTYPE_FLOAT64:
            case DTYPE_FLOAT32: {
                if (cast_double) {
                    auto x = scalar.to_uint64();
                    double y = *reinterpret_cast<double*>(&x);
                    return t_val(y);
                } else {
                    return t_val(scalar.to_double());
                }
            }
            case DTYPE_DATE: {
                return t_date_to_jsdate(scalar.get<t_date>()).call<t_val>("getTime");
            }
            case DTYPE_UINT8:
            case DTYPE_UINT16:
            case DTYPE_UINT32:
            case DTYPE_INT8:
            case DTYPE_INT16:
            case DTYPE_INT32: {
                return t_val(static_cast<std::int32_t>(scalar.to_int64()));
            }
            case DTYPE_UINT64:
            case DTYPE_INT64: {
                // This could potentially lose precision
                return t_val(static_cast<std::int32_t>(scalar.to_int64()));
            }
            case DTYPE_NONE: {
                return t_val::null();
            }
            case DTYPE_STR:
            default: {
                std::wstring_convert<utf8convert_type, wchar_t> converter("", L"<Invalid>");
                return t_val(converter.from_bytes(scalar.to_string()));
            }
        }
    }

    t_val
    scalar_vec_to_val(const std::vector<t_tscalar>& scalars, std::uint32_t idx) {
        return scalar_to_val(scalars[idx]);
    }

    t_val
    scalar_vec_to_string(const std::vector<t_tscalar>& scalars, std::uint32_t idx) {
        return scalar_to_val(scalars[idx], false, true);
    }

    template <typename T, typename U>
    std::vector<U>
    vecFromArray(T& arr) {
        return vecFromJSArray<U>(arr);
    }

    template <>
    t_val
    scalar_to(const t_tscalar& scalar) {
        return scalar_to_val(scalar);
    }

    template <>
    t_val
    scalar_vec_to(const std::vector<t_tscalar>& scalars, std::uint32_t idx) {
        return scalar_vec_to_val(scalars, idx);
    }

    /**
     * Converts a std::vector<T> to a Typed Array, slicing directly from the
     * WebAssembly heap.
     */
    template <typename T>
    t_val
    vector_to_typed_array(std::vector<T>& xs) {
        T* st = &xs[0];
        uintptr_t offset = reinterpret_cast<uintptr_t>(st);
        return t_val::module_property("HEAPU8").call<t_val>(
            "slice", offset, offset + (sizeof(T) * xs.size()));
    }

    /******************************************************************************
     *
     * Write data in the Apache Arrow format
     */
    namespace arrow {

        template <>
        void
        vecFromTypedArray(
            const t_val& typedArray, void* data, std::int32_t length, const char* destType) {
            t_val memory = t_val::module_property("buffer");
            if (destType == nullptr) {
                t_val memoryView = typedArray["constructor"].new_(
                    memory, reinterpret_cast<std::uintptr_t>(data), length);
                memoryView.call<void>("set", typedArray.call<t_val>("slice", 0, length));
            } else {
                t_val memoryView = t_val::global(destType).new_(
                    memory, reinterpret_cast<std::uintptr_t>(data), length);
                memoryView.call<void>("set", typedArray.call<t_val>("slice", 0, length));
            }
        }

        template <>
        void
        fill_col_valid(t_val dcol, std::shared_ptr<t_column> col) {
            // dcol should be the Uint8Array containing the null bitmap
            t_uindex nrows = col->size();

            // arrow packs bools into a bitmap
            for (auto i = 0; i < nrows; ++i) {
                std::uint8_t elem = dcol[i / 8].as<std::uint8_t>();
                bool v = elem & (1 << (i % 8));
                col->set_valid(i, v);
            }
        }

        template <>
        void
        fill_col_dict(t_val dictvec, std::shared_ptr<t_column> col) {
            // ptaylor: This assumes the dictionary is either a Binary or Utf8 Vector. Should it
            // support other Vector types?
            t_val vdata = dictvec["values"];
            std::int32_t vsize = vdata["length"].as<std::int32_t>();
            std::vector<unsigned char> data;
            data.reserve(vsize);
            data.resize(vsize);
            vecFromTypedArray(vdata, data.data(), vsize);

            t_val voffsets = dictvec["valueOffsets"];
            std::int32_t osize = voffsets["length"].as<std::int32_t>();
            std::vector<std::int32_t> offsets;
            offsets.reserve(osize);
            offsets.resize(osize);
            vecFromTypedArray(voffsets, offsets.data(), osize);

            // Get number of dictionary entries
            std::uint32_t dsize = dictvec["length"].as<std::uint32_t>();

            t_vocab* vocab = col->_get_vocab();
            std::string elem;

            for (std::uint32_t i = 0; i < dsize; ++i) {
                std::int32_t bidx = offsets[i];
                std::size_t es = offsets[i + 1] - bidx;
                elem.assign(reinterpret_cast<char*>(data.data()) + bidx, es);
                t_uindex idx = vocab->get_interned(elem);
                // Make sure there are no duplicates in the arrow dictionary
                assert(idx == i);
            }
        }
    } // namespace arrow

    namespace js_typed_array {
        t_val ArrayBuffer = t_val::global("ArrayBuffer");
        t_val Int8Array = t_val::global("Int8Array");
        t_val Int16Array = t_val::global("Int16Array");
        t_val Int32Array = t_val::global("Int32Array");
        t_val UInt8Array = t_val::global("Uint8Array");
        t_val UInt32Array = t_val::global("Uint32Array");
        t_val Float32Array = t_val::global("Float32Array");
        t_val Float64Array = t_val::global("Float64Array");
    } // namespace js_typed_array

    template <typename T>
    const t_val typed_array = t_val::null();

    template <>
    const t_val typed_array<double> = js_typed_array::Float64Array;
    template <>
    const t_val typed_array<float> = js_typed_array::Float32Array;
    template <>
    const t_val typed_array<std::int8_t> = js_typed_array::Int8Array;
    template <>
    const t_val typed_array<std::int16_t> = js_typed_array::Int16Array;
    template <>
    const t_val typed_array<std::int32_t> = js_typed_array::Int32Array;
    template <>
    const t_val typed_array<std::uint32_t> = js_typed_array::UInt32Array;

    template <>
    double
    get_scalar<double>(t_tscalar& t) {
        return t.to_double();
    }
    template <>
    float
    get_scalar<float>(t_tscalar& t) {
        return t.to_double();
    }
    template <>
    std::uint8_t
    get_scalar<std::uint8_t>(t_tscalar& t) {
        return static_cast<std::uint8_t>(t.to_int64());
    }
    template <>
    std::int8_t
    get_scalar<std::int8_t>(t_tscalar& t) {
        return static_cast<std::int8_t>(t.to_int64());
    }
    template <>
    std::int16_t
    get_scalar<std::int16_t>(t_tscalar& t) {
        return static_cast<std::int16_t>(t.to_int64());
    }
    template <>
    std::int32_t
    get_scalar<std::int32_t>(t_tscalar& t) {
        return static_cast<std::int32_t>(t.to_int64());
    }
    template <>
    std::uint32_t
    get_scalar<std::uint32_t>(t_tscalar& t) {
        return static_cast<std::uint32_t>(t.to_int64());
    }
    template <>
    double
    get_scalar<t_date, double>(t_tscalar& t) {
        auto x = t.to_uint64();
        return *reinterpret_cast<double*>(&x);
    }

    template <typename T, typename F = T, typename O = T>
    val
    col_to_typed_array(std::vector<t_tscalar> const& data) {
        int data_size = data.size();
        std::vector<T> vals;
        vals.reserve(data.size());

        // Validity map must have a length that is a multiple of 64
        int nullSize = ceil(data_size / 64.0) * 2;
        int nullCount = 0;
        std::vector<std::uint32_t> validityMap;
        validityMap.resize(nullSize);

        for (int idx = 0; idx < data_size; idx++) {
            t_tscalar scalar = data[idx];
            if (scalar.is_valid() && scalar.get_dtype() != DTYPE_NONE) {
                vals.push_back(get_scalar<F, T>(scalar));
                // Mark the slot as non-null (valid)
                validityMap[idx / 32] |= 1 << (idx % 32);
            } else {
                vals.push_back({});
                nullCount++;
            }
        }

        t_val arr = t_val::global("Array").new_();
        arr.call<void>("push", typed_array<O>.new_(vector_to_typed_array(vals)["buffer"]));
        arr.call<void>("push", nullCount);
        arr.call<void>("push", vector_to_typed_array(validityMap));
        return arr;
    }

    template <>
    val
    col_to_typed_array<bool>(std::vector<t_tscalar> const& data) {
        int data_size = data.size();

        std::vector<std::int8_t> vals;
        vals.reserve(data.size());

        // Validity map must have a length that is a multiple of 64
        int nullSize = ceil(data_size / 64.0) * 2;
        int nullCount = 0;
        std::vector<std::uint32_t> validityMap;
        validityMap.resize(nullSize);

        for (int idx = 0; idx < data_size; idx++) {
            t_tscalar scalar = data[idx];
            if (scalar.is_valid() && scalar.get_dtype() != DTYPE_NONE) {
                // get boolean and write into array
                std::int8_t t_val = get_scalar<std::int8_t>(scalar);
                vals.push_back(t_val);
                // bit mask based on value in array
                vals[idx / 8] |= t_val << (idx % 8);
                // Mark the slot as non-null (valid)
                validityMap[idx / 32] |= 1 << (idx % 32);
            } else {
                vals.push_back({});
                nullCount++;
            }
        }

        t_val arr = t_val::global("Array").new_();
        arr.call<void>(
            "push", typed_array<std::int8_t>.new_(vector_to_typed_array(vals)["buffer"]));
        arr.call<void>("push", nullCount);
        arr.call<void>("push", vector_to_typed_array(validityMap));
        return arr;
    }

    template <>
    val
    col_to_typed_array<std::string>(std::vector<t_tscalar> const& data) {
        int data_size = data.size();

        t_vocab vocab;
        vocab.init(false);

        int nullSize = ceil(data_size / 64.0) * 2;
        int nullCount = 0;
        std::vector<std::uint32_t> validityMap; // = new std::uint32_t[nullSize];
        validityMap.resize(nullSize);
        t_val indexBuffer = js_typed_array::ArrayBuffer.new_(data_size * 4);
        t_val indexArray = js_typed_array::UInt32Array.new_(indexBuffer);

        for (int idx = 0; idx < data_size; idx++) {
            t_tscalar scalar = data[idx];
            if (scalar.is_valid() && scalar.get_dtype() != DTYPE_NONE) {
                auto adx = vocab.get_interned(scalar.to_string());
                indexArray.call<void>("fill", t_val(adx), idx, idx + 1);
                validityMap[idx / 32] |= 1 << (idx % 32);
            } else {
                nullCount++;
            }
        }
        t_val dictBuffer = js_typed_array::ArrayBuffer.new_(
            vocab.get_vlendata()->size() - vocab.get_vlenidx());
        t_val dictArray = js_typed_array::UInt8Array.new_(dictBuffer);
        std::vector<std::uint32_t> offsets;
        offsets.reserve(vocab.get_vlenidx() + 1);
        std::uint32_t index = 0;
        for (auto i = 0; i < vocab.get_vlenidx(); i++) {
            const char* str = vocab.unintern_c(i);
            offsets.push_back(index);
            while (*str) {
                dictArray.call<void>("fill", t_val(*str++), index, index + 1);
                index++;
            }
        }
        offsets.push_back(index);

        t_val arr = t_val::global("Array").new_();
        arr.call<void>("push", dictArray);
        arr.call<void>(
            "push", js_typed_array::UInt32Array.new_(vector_to_typed_array(offsets)["buffer"]));
        arr.call<void>("push", indexArray);
        arr.call<void>("push", nullCount);
        arr.call<void>("push", vector_to_typed_array(validityMap));
        return arr;
    }

    t_val
    col_to_js_typed_array(const std::vector<t_tscalar>& data, t_dtype dtype, t_index idx) {
        switch (dtype) {
            case DTYPE_INT8: {
                return col_to_typed_array<std::int8_t>(data);
            } break;
            case DTYPE_INT16: {
                return col_to_typed_array<std::int16_t>(data);
            } break;
            case DTYPE_DATE:
            case DTYPE_TIME: {
                return col_to_typed_array<double, t_date, std::int32_t>(data);
            } break;
            case DTYPE_INT32:
            case DTYPE_UINT32: {
                return col_to_typed_array<std::uint32_t>(data);
            } break;
            case DTYPE_INT64: {
                return col_to_typed_array<std::int32_t>(data);
            } break;
            case DTYPE_FLOAT32: {
                return col_to_typed_array<float>(data);
            } break;
            case DTYPE_FLOAT64: {
                return col_to_typed_array<double>(data);
            } break;
            case DTYPE_BOOL: {
                return col_to_typed_array<bool>(data);
            } break;
            case DTYPE_STR: {
                return col_to_typed_array<std::string>(data);
            } break;
            default: {
                PSP_COMPLAIN_AND_ABORT("Unhandled aggregate type");
                return t_val::undefined();
            }
        }
    }

    /******************************************************************************
     *
     * Fill columns with data
     */

    void
    _fill_col_int64(t_data_accessor accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            t_val data = accessor["values"];
            // arrow packs 64 bit into two 32 bit ints
            arrow::vecFromTypedArray(data, col->get_nth<std::int64_t>(0), nrows * 2);
        } else {
            PSP_COMPLAIN_AND_ABORT(
                "Unreachable - can't have DTYPE_INT64 column from non-arrow data");
        }
    }

    void
    _fill_col_time(t_data_accessor accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            t_val data = accessor["values"];
            // arrow packs 64 bit into two 32 bit ints
            arrow::vecFromTypedArray(data, col->get_nth<t_time>(0), nrows * 2);

            std::int8_t unit = accessor["type"]["unit"].as<std::int8_t>();
            if (unit != /* Arrow.enum_.TimeUnit.MILLISECOND */ 1) {
                // Slow path - need to convert each value
                std::int64_t factor = 1;
                if (unit == /* Arrow.enum_.TimeUnit.NANOSECOND */ 3) {
                    factor = 1e6;
                } else if (unit == /* Arrow.enum_.TimeUnit.MICROSECOND */ 2) {
                    factor = 1e3;
                }
                for (auto i = 0; i < nrows; ++i) {
                    col->set_nth<std::int64_t>(i, *(col->get_nth<std::int64_t>(i)) / factor);
                }
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                t_val item = accessor.call<t_val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                auto elem = static_cast<std::int64_t>(
                    item.call<t_val>("getTime").as<double>()); // dcol[i].as<T>();
                col->set_nth(i, elem);
            }
        }
    }

    void
    _fill_col_date(t_data_accessor accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            // t_val data = dcol["values"];
            // // arrow packs 64 bit into two 32 bit ints
            // arrow::vecFromTypedArray(data, col->get_nth<t_time>(0), nrows * 2);

            // std::int8_t unit = dcol["type"]["unit"].as<std::int8_t>();
            // if (unit != /* Arrow.enum_.TimeUnit.MILLISECOND */ 1) {
            //     // Slow path - need to convert each value
            //     std::int64_t factor = 1;
            //     if (unit == /* Arrow.enum_.TimeUnit.NANOSECOND */ 3) {
            //         factor = 1e6;
            //     } else if (unit == /* Arrow.enum_.TimeUnit.MICROSECOND */ 2) {
            //         factor = 1e3;
            //     }
            //     for (auto i = 0; i < nrows; ++i) {
            //         col->set_nth<std::int32_t>(i, *(col->get_nth<std::int32_t>(i)) / factor);
            //     }
            // }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                t_val item = accessor.call<t_val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                col->set_nth(i, jsdate_to_t_date(item));
            }
        }
    }

    void
    _fill_col_bool(t_data_accessor accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            // bools are stored using a bit mask
            t_val data = accessor["values"];
            for (auto i = 0; i < nrows; ++i) {
                t_val item = data[i / 8];

                if (item.isUndefined()) {
                    continue;
                }

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                std::uint8_t elem = item.as<std::uint8_t>();
                bool v = elem & (1 << (i % 8));
                col->set_nth(i, v);
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                t_val item = accessor.call<t_val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                auto elem = item.as<bool>();
                col->set_nth(i, elem);
            }
        }
    }

    void
    _fill_col_string(t_data_accessor accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {

        t_uindex nrows = col->size();

        if (is_arrow) {
            if (accessor["constructor"]["name"].as<std::string>() == "DictionaryVector") {

                t_val dictvec = accessor["dictionary"];
                arrow::fill_col_dict(dictvec, col);

                // Now process index into dictionary

                // Perspective stores string indices in a 32bit unsigned array
                // Javascript's typed arrays handle copying from various bitwidth arrays
                // properly
                t_val vkeys = accessor["indices"]["values"];
                arrow::vecFromTypedArray(
                    vkeys, col->get_nth<t_uindex>(0), nrows, "Uint32Array");

            } else if (accessor["constructor"]["name"].as<std::string>() == "Utf8Vector"
                || accessor["constructor"]["name"].as<std::string>() == "BinaryVector") {

                t_val vdata = accessor["values"];
                std::int32_t vsize = vdata["length"].as<std::int32_t>();
                std::vector<std::uint8_t> data;
                data.reserve(vsize);
                data.resize(vsize);
                arrow::vecFromTypedArray(vdata, data.data(), vsize);

                t_val voffsets = accessor["valueOffsets"];
                std::int32_t osize = voffsets["length"].as<std::int32_t>();
                std::vector<std::int32_t> offsets;
                offsets.reserve(osize);
                offsets.resize(osize);
                arrow::vecFromTypedArray(voffsets, offsets.data(), osize);

                std::string elem;

                for (std::int32_t i = 0; i < nrows; ++i) {
                    std::int32_t bidx = offsets[i];
                    std::size_t es = offsets[i + 1] - bidx;
                    elem.assign(reinterpret_cast<char*>(data.data()) + bidx, es);
                    col->set_nth(i, elem);
                }
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                t_val item = accessor.call<t_val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                std::wstring welem = item.as<std::wstring>();
                std::wstring_convert<utf16convert_type, wchar_t> converter;
                std::string elem = converter.to_bytes(welem);
                col->set_nth(i, elem);
            }
        }
    }

    void
    _fill_col_numeric(t_data_accessor accessor, t_data_table& tbl,
        std::shared_ptr<t_column> col, std::string name, std::int32_t cidx, t_dtype type,
        bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            t_val data = accessor["values"];

            switch (type) {
                case DTYPE_INT8: {
                    arrow::vecFromTypedArray(data, col->get_nth<std::int8_t>(0), nrows);
                } break;
                case DTYPE_INT16: {
                    arrow::vecFromTypedArray(data, col->get_nth<std::int16_t>(0), nrows);
                } break;
                case DTYPE_INT32: {
                    arrow::vecFromTypedArray(data, col->get_nth<std::int32_t>(0), nrows);
                } break;
                case DTYPE_FLOAT32: {
                    arrow::vecFromTypedArray(data, col->get_nth<float>(0), nrows);
                } break;
                case DTYPE_FLOAT64: {
                    arrow::vecFromTypedArray(data, col->get_nth<double>(0), nrows);
                } break;
                default:
                    break;
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                t_val item = accessor.call<t_val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                switch (type) {
                    case DTYPE_INT8: {
                        col->set_nth(i, item.as<std::int8_t>());
                    } break;
                    case DTYPE_INT16: {
                        col->set_nth(i, item.as<std::int16_t>());
                    } break;
                    case DTYPE_INT32: {
                        // This handles cases where a long sequence of e.g. 0 precedes a clearly
                        // float value in an inferred column. Would not be needed if the type
                        // inference checked the entire column/we could reset parsing.
                        double fval = item.as<double>();
                        if (fval > 2147483647 || fval < -2147483648) {
                            std::cout << "Promoting to float" << std::endl;
                            tbl.promote_column(name, DTYPE_FLOAT64, i, true);
                            col = tbl.get_column(name);
                            type = DTYPE_FLOAT64;
                            col->set_nth(i, fval);
                        } else if (isnan(fval)) {
                            std::cout << "Promoting to string" << std::endl;
                            tbl.promote_column(name, DTYPE_STR, i, false);
                            col = tbl.get_column(name);
                            _fill_col_string(
                                accessor, col, name, cidx, DTYPE_STR, is_arrow, is_update);
                            return;
                        } else {
                            col->set_nth(i, static_cast<std::int32_t>(fval));
                        }
                    } break;
                    case DTYPE_FLOAT32: {
                        col->set_nth(i, item.as<float>());
                    } break;
                    case DTYPE_FLOAT64: {
                        col->set_nth(i, item.as<double>());
                    } break;
                    default:
                        break;
                }
            }
        }
    }

    template <>
    void
    set_column_nth(t_column* col, t_uindex idx, t_val value) {

        // Check if the value is a javascript null
        if (value.isNull()) {
            col->unset(idx);
            return;
        }

        switch (col->get_dtype()) {
            case DTYPE_BOOL: {
                col->set_nth<bool>(idx, value.as<bool>(), STATUS_VALID);
                break;
            }
            case DTYPE_FLOAT64: {
                col->set_nth<double>(idx, value.as<double>(), STATUS_VALID);
                break;
            }
            case DTYPE_FLOAT32: {
                col->set_nth<float>(idx, value.as<float>(), STATUS_VALID);
                break;
            }
            case DTYPE_UINT32: {
                col->set_nth<std::uint32_t>(idx, value.as<std::uint32_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_UINT64: {
                col->set_nth<std::uint64_t>(idx, value.as<std::uint64_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_INT32: {
                col->set_nth<std::int32_t>(idx, value.as<std::int32_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_INT64: {
                col->set_nth<std::int64_t>(idx, value.as<std::int64_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_STR: {
                std::wstring welem = value.as<std::wstring>();

                std::wstring_convert<utf16convert_type, wchar_t> converter;
                std::string elem = converter.to_bytes(welem);
                col->set_nth(idx, elem, STATUS_VALID);
                break;
            }
            case DTYPE_DATE: {
                col->set_nth<t_date>(idx, jsdate_to_t_date(value), STATUS_VALID);
                break;
            }
            case DTYPE_TIME: {
                col->set_nth<std::int64_t>(
                    idx, static_cast<std::int64_t>(value.as<double>()), STATUS_VALID);
                break;
            }
            case DTYPE_UINT8:
            case DTYPE_UINT16:
            case DTYPE_INT8:
            case DTYPE_INT16:
            default: {
                // Other types not implemented
            }
        }
    }

    template <>
    void
    table_add_computed_column(t_data_table& table, t_val computed_defs) {
        auto vcomputed_defs = vecFromArray<t_val, t_val>(computed_defs);
        for (auto i = 0; i < vcomputed_defs.size(); ++i) {
            t_val coldef = vcomputed_defs[i];
            std::string name = coldef["column"].as<std::string>();
            t_val inputs = coldef["inputs"];
            t_val func = coldef["func"];
            t_val type = coldef["type"];

            std::string stype;

            if (type.isUndefined()) {
                stype = "string";
            } else {
                stype = type.as<std::string>();
            }

            t_dtype dtype;
            if (stype == "integer") {
                dtype = DTYPE_INT32;
            } else if (stype == "float") {
                dtype = DTYPE_FLOAT64;
            } else if (stype == "boolean") {
                dtype = DTYPE_BOOL;
            } else if (stype == "date") {
                dtype = DTYPE_DATE;
            } else if (stype == "datetime") {
                dtype = DTYPE_TIME;
            } else {
                dtype = DTYPE_STR;
            }

            // Get list of input column names
            auto icol_names = vecFromArray<t_val, std::string>(inputs);

            // Get t_column* for all input columns
            std::vector<const t_column*> icols;
            for (const auto& cc : icol_names) {
                icols.push_back(table._get_column(cc));
            }

            int arity = icols.size();

            // Add new column
            t_column* out = table.add_column(name, dtype, true);

            t_val i1 = t_val::undefined(), i2 = t_val::undefined(), i3 = t_val::undefined(),
                  i4 = t_val::undefined();

            t_uindex size = table.size();
            for (t_uindex ridx = 0; ridx < size; ++ridx) {
                t_val value = t_val::undefined();

                switch (arity) {
                    case 0: {
                        value = func();
                        break;
                    }
                    case 1: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        if (!i1.isNull()) {
                            value = func(i1);
                        }
                        break;
                    }
                    case 2: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        i2 = scalar_to_val(icols[1]->get_scalar(ridx));
                        if (!i1.isNull() && !i2.isNull()) {
                            value = func(i1, i2);
                        }
                        break;
                    }
                    case 3: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        i2 = scalar_to_val(icols[1]->get_scalar(ridx));
                        i3 = scalar_to_val(icols[2]->get_scalar(ridx));
                        if (!i1.isNull() && !i2.isNull() && !i3.isNull()) {
                            value = func(i1, i2, i3);
                        }
                        break;
                    }
                    case 4: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        i2 = scalar_to_val(icols[1]->get_scalar(ridx));
                        i3 = scalar_to_val(icols[2]->get_scalar(ridx));
                        i4 = scalar_to_val(icols[3]->get_scalar(ridx));
                        if (!i1.isNull() && !i2.isNull() && !i3.isNull() && !i4.isNull()) {
                            value = func(i1, i2, i3, i4);
                        }
                        break;
                    }
                    default: {
                        // Don't handle other arity values
                        break;
                    }
                }

                if (!value.isUndefined()) {
                    set_column_nth(out, ridx, value);
                }
            }
        }
    }

    /******************************************************************************
     *
     * Fill tables with data
     */

    void
    _fill_data(t_data_table& tbl, t_data_accessor accessor, std::vector<std::string> col_names,
        std::vector<t_dtype> data_types, std::uint32_t offset, bool is_arrow, bool is_update) {

        for (auto cidx = 0; cidx < col_names.size(); ++cidx) {
            auto name = col_names[cidx];
            auto col = tbl.get_column(name);
            auto col_type = data_types[cidx];

            t_val dcol = t_val::undefined();

            if (is_arrow) {
                dcol = accessor["cdata"][cidx];
            } else {
                dcol = accessor;
            }

            switch (col_type) {
                case DTYPE_INT64: {
                    _fill_col_int64(dcol, col, name, cidx, col_type, is_arrow, is_update);
                } break;
                case DTYPE_BOOL: {
                    _fill_col_bool(dcol, col, name, cidx, col_type, is_arrow, is_update);
                } break;
                case DTYPE_DATE: {
                    _fill_col_date(dcol, col, name, cidx, col_type, is_arrow, is_update);
                } break;
                case DTYPE_TIME: {
                    _fill_col_time(dcol, col, name, cidx, col_type, is_arrow, is_update);
                } break;
                case DTYPE_STR: {
                    _fill_col_string(dcol, col, name, cidx, col_type, is_arrow, is_update);
                } break;
                case DTYPE_NONE: {
                    break;
                }
                default:
                    _fill_col_numeric(
                        dcol, tbl, col, name, cidx, col_type, is_arrow, is_update);
            }

            if (is_arrow) {
                // Fill validity bitmap
                std::uint32_t null_count = dcol["nullCount"].as<std::uint32_t>();

                if (null_count == 0) {
                    col->valid_raw_fill();
                } else {
                    t_val validity = dcol["nullBitmap"];
                    arrow::fill_col_valid(validity, col);
                }
            }
        }
    }

    /******************************************************************************
     *
     * Data accessor API
     */

    std::vector<std::string>
    get_column_names(t_val data, std::int32_t format) {
        std::vector<std::string> names;
        t_val Object = t_val::global("Object");

        if (format == 0) {
            std::int32_t max_check = 50;
            t_val data_names = Object.call<t_val>("keys", data[0]);
            names = vecFromArray<t_val, std::string>(data_names);
            std::int32_t check_index = std::min(max_check, data["length"].as<std::int32_t>());

            for (auto ix = 0; ix < check_index; ix++) {
                t_val next = Object.call<t_val>("keys", data[ix]);

                if (names.size() != next["length"].as<std::int32_t>()) {
                    auto old_size = names.size();
                    auto new_names = vecFromJSArray<std::string>(next);
                    if (max_check == 50) {
                        std::cout << "Data parse warning: Array data has inconsistent rows"
                                  << std::endl;
                    }

                    for (auto s = new_names.begin(); s != new_names.end(); ++s) {
                        if (std::find(names.begin(), names.end(), *s) == names.end()) {
                            names.push_back(*s);
                        }
                    }

                    std::cout << "Extended from " << old_size << "to " << names.size()
                              << std::endl;
                    max_check *= 2;
                }
            }
        } else if (format == 1 || format == 2) {
            t_val keys = Object.call<t_val>("keys", data);
            names = vecFromArray<t_val, std::string>(keys);
        }

        return names;
    }

    t_dtype
    infer_type(t_val x, t_val date_validator) {
        std::string jstype = x.typeOf().as<std::string>();
        t_dtype t = t_dtype::DTYPE_STR;

        // Unwrap numbers inside strings
        t_val x_number = t_val::global("Number").call<t_val>("call", t_val::object(), x);
        bool number_in_string = (jstype == "string") && (x["length"].as<std::int32_t>() != 0)
            && (!t_val::global("isNaN").call<bool>("call", t_val::object(), x_number));

        if (x.isNull()) {
            t = t_dtype::DTYPE_NONE;
        } else if (jstype == "number" || number_in_string) {
            if (number_in_string) {
                x = x_number;
            }
            double x_float64 = x.as<double>();
            if ((std::fmod(x_float64, 1.0) == 0.0) && (x_float64 < 10000.0)
                && (x_float64 != 0.0)) {
                t = t_dtype::DTYPE_INT32;
            } else {
                t = t_dtype::DTYPE_FLOAT64;
            }
        } else if (jstype == "boolean") {
            t = t_dtype::DTYPE_BOOL;
        } else if (x.instanceof (t_val::global("Date"))) {
            std::int32_t hours = x.call<t_val>("getHours").as<std::int32_t>();
            std::int32_t minutes = x.call<t_val>("getMinutes").as<std::int32_t>();
            std::int32_t seconds = x.call<t_val>("getSeconds").as<std::int32_t>();
            std::int32_t milliseconds = x.call<t_val>("getMilliseconds").as<std::int32_t>();

            if (hours == 0 && minutes == 0 && seconds == 0 && milliseconds == 0) {
                t = t_dtype::DTYPE_DATE;
            } else {
                t = t_dtype::DTYPE_TIME;
            }
        } else if (jstype == "string") {
            if (date_validator.call<t_val>("call", t_val::object(), x).as<bool>()) {
                t = t_dtype::DTYPE_TIME;
            } else {
                std::string lower = x.call<t_val>("toLowerCase").as<std::string>();
                if (lower == "true" || lower == "false") {
                    t = t_dtype::DTYPE_BOOL;
                } else {
                    t = t_dtype::DTYPE_STR;
                }
            }
        }

        return t;
    }

    t_dtype
    get_data_type(
        t_val data, std::int32_t format, const std::string& name, t_val date_validator) {
        std::int32_t i = 0;
        boost::optional<t_dtype> inferredType;

        if (format == 0) {
            // loop parameters differ slightly so rewrite the loop
            while (!inferredType.is_initialized() && i < 100
                && i < data["length"].as<std::int32_t>()) {
                if (data[i].call<t_val>("hasOwnProperty", name).as<bool>() == true) {
                    if (!data[i][name].isNull()) {
                        inferredType = infer_type(data[i][name], date_validator);
                    } else {
                        inferredType = t_dtype::DTYPE_STR;
                    }
                }

                i++;
            }
        } else if (format == 1) {
            while (!inferredType.is_initialized() && i < 100
                && i < data[name]["length"].as<std::int32_t>()) {
                if (!data[name][i].isNull()) {
                    inferredType = infer_type(data[name][i], date_validator);
                } else {
                    inferredType = t_dtype::DTYPE_STR;
                }

                i++;
            }
        }

        if (!inferredType.is_initialized()) {
            return t_dtype::DTYPE_STR;
        } else {
            return inferredType.get();
        }
    }

    std::vector<t_dtype>
    get_data_types(t_val data, std::int32_t format, const std::vector<std::string>& names,
        t_val date_validator) {
        if (names.size() == 0) {
            PSP_COMPLAIN_AND_ABORT("Cannot determine data types without column names!");
        }

        std::vector<t_dtype> types;

        if (format == 2) {
            t_val keys = t_val::global("Object").template call<t_val>("keys", data);
            std::vector<std::string> data_names = vecFromArray<t_val, std::string>(keys);

            for (const std::string& name : data_names) {
                std::string value = data[name].as<std::string>();
                t_dtype type;

                if (value == "integer") {
                    type = t_dtype::DTYPE_INT32;
                } else if (value == "float") {
                    type = t_dtype::DTYPE_FLOAT64;
                } else if (value == "string") {
                    type = t_dtype::DTYPE_STR;
                } else if (value == "boolean") {
                    type = t_dtype::DTYPE_BOOL;
                } else if (value == "datetime") {
                    type = t_dtype::DTYPE_TIME;
                } else if (value == "date") {
                    type = t_dtype::DTYPE_DATE;
                } else {
                    PSP_COMPLAIN_AND_ABORT(
                        "Unknown type '" + value + "' for key '" + name + "'");
                }

                types.push_back(type);
            }

            return types;
        } else {
            for (const std::string& name : names) {
                t_dtype type = get_data_type(data, format, name, date_validator);
                types.push_back(type);
            }
        }

        return types;
    }

    /******************************************************************************
     *
     * Table API
     */

    template <>
    std::shared_ptr<t_gnode>
    make_data_table(std::shared_ptr<t_pool> pool, t_val gnode, t_data_accessor accessor,
        t_val computed, std::uint32_t offset, std::uint32_t limit, std::string index, t_op op,
        bool is_arrow) {
        std::uint32_t size = accessor["row_count"].as<std::int32_t>();

        std::vector<std::string> column_names;
        std::vector<t_dtype> data_types;

        bool is_update = op == OP_UPDATE;
        bool is_delete = op == OP_DELETE;

        // Determine metadata
        if (is_arrow || (is_update || is_delete)) {
            t_val names = accessor["names"];
            t_val types = accessor["types"];
            column_names = vecFromArray<t_val, std::string>(names);
            data_types = vecFromArray<t_val, t_dtype>(types);
        } else {
            // Infer names and types
            t_val data = accessor["data"];
            std::int32_t format = accessor["format"].as<std::int32_t>();
            column_names = get_column_names(data, format);
            data_types = get_data_types(data, format, column_names, accessor["date_validator"]);
        }

        // Check if index is valid after getting column names
        bool valid_index
            = std::find(column_names.begin(), column_names.end(), index) != column_names.end();
        if (index != "" && !valid_index) {
            PSP_COMPLAIN_AND_ABORT("Specified index '" + index + "' does not exist in data.")
        }

        bool is_new_gnode = gnode.isUndefined();
        std::shared_ptr<t_gnode> new_gnode;
        if (!is_new_gnode) {
            new_gnode = gnode.as<std::shared_ptr<t_gnode>>();
            if (is_arrow && is_update && new_gnode->get_table()->size() == 0) {
                auto schema = new_gnode->get_table()->get_schema();
                for (auto idx = 0; idx < schema.m_types.size(); ++idx) {
                    if (dtypes[idx] == DTYPE_INT64) {
                        std::cout << "Promoting int64 `" << colnames[idx] << "`" << std::endl;
                        new_gnode->promote_column(colnames[idx], DTYPE_INT64);
                    }
                }
            }
        }

        // Create the table
        // TODO assert size > 0
        t_data_table tbl(t_schema(column_names, data_types));
        tbl.init();
        tbl.extend(size);

        bool is_new_gnode = gnode.isUndefined();
        std::shared_ptr<t_gnode> new_gnode;
        if (!is_new_gnode) {
            new_gnode = gnode.as<std::shared_ptr<t_gnode>>();
        }

        _fill_data(tbl, accessor, column_names, data_types, offset, is_arrow,
            (is_update || new_gnode->mapping_size() > 0));

        // Set up pkey and op columns
        if (is_delete) {
            auto op_col = tbl.add_column("psp_op", DTYPE_UINT8, false);
            op_col->raw_fill<std::uint8_t>(OP_DELETE);
        } else {
            auto op_col = tbl.add_column("psp_op", DTYPE_UINT8, false);
            op_col->raw_fill<std::uint8_t>(OP_INSERT);
        }

        if (index == "") {
            // If user doesn't specify an column to use as the pkey index, just use
            // row number
            auto key_col = tbl.add_column("psp_pkey", DTYPE_INT32, true);
            auto okey_col = tbl.add_column("psp_okey", DTYPE_INT32, true);

            for (auto ridx = 0; ridx < tbl.size(); ++ridx) {
                key_col->set_nth<std::int32_t>(ridx, (ridx + offset) % limit);
                okey_col->set_nth<std::int32_t>(ridx, (ridx + offset) % limit);
            }
        } else {
            tbl.clone_column(index, "psp_pkey");
            tbl.clone_column(index, "psp_okey");
        }

        if (!computed.isUndefined()) {
            table_add_computed_column(tbl, computed);
        }

        if (is_new_gnode) {
            new_gnode = make_gnode(tbl.get_schema());
            pool->register_gnode(new_gnode.get());
        }

        pool->send(new_gnode->get_id(), 0, tbl);
        return new_gnode;
    }

    std::shared_ptr<t_pool>
    make_pool() {
        auto pool = std::make_shared<t_pool>();
        return pool;
    }

    std::shared_ptr<t_gnode>
    make_gnode(const t_schema& in_schema) {
        std::vector<std::string> col_names(in_schema.columns());
        std::vector<t_dtype> data_types(in_schema.types());

        if (in_schema.has_column("psp_pkey")) {
            t_uindex idx = in_schema.get_colidx("psp_pkey");
            col_names.erase(col_names.begin() + idx);
            data_types.erase(data_types.begin() + idx);
        }

        if (in_schema.has_column("psp_op")) {
            t_uindex idx = in_schema.get_colidx("psp_op");
            col_names.erase(col_names.begin() + idx);
            data_types.erase(data_types.begin() + idx);
        }

        t_schema out_schema(col_names, data_types);

        // Create a gnode
        auto gnode = std::make_shared<t_gnode>(out_schema, in_schema);
        gnode->init();

        return gnode;
    }

    template <>
    std::shared_ptr<t_gnode>
    clone_gnode_table(
        std::shared_ptr<t_pool> pool, std::shared_ptr<t_gnode> gnode, t_val computed) {
        t_data_table* tbl = gnode->_get_pkeyed_table();
        table_add_computed_column(*tbl, computed);
        std::shared_ptr<t_gnode> new_gnode = make_gnode(tbl->get_schema());
        pool->register_gnode(new_gnode.get());
        pool->send(new_gnode->get_id(), 0, *tbl);
        pool->_process();
        return new_gnode;
    }

    /******************************************************************************
     *
     * View API
     */
    template <>
    t_config
    make_view_config(
        const t_schema& schema, std::string separator, t_val date_parser, t_val config) {
        t_val j_row_pivots = config["row_pivots"];
        t_val j_column_pivots = config["column_pivots"];
        t_val j_aggregates = config["aggregates"];
        t_val j_columns = config["columns"];
        t_val j_filter = config["filter"];
        t_val j_sort = config["sort"];

        std::vector<std::string> row_pivots;
        std::vector<std::string> column_pivots;
        std::vector<t_aggspec> aggregates;
        std::vector<std::string> aggregate_names;
        std::vector<std::string> columns;
        std::vector<t_fterm> filters;
        std::vector<t_val> sortbys;
        std::vector<t_sortspec> sorts;
        std::vector<t_sortspec> col_sorts;

        t_filter_op filter_op = t_filter_op::FILTER_OP_AND;

        if (hasValue(j_row_pivots)) {
            row_pivots = vecFromArray<t_val, std::string>(j_row_pivots);
        }

        if (hasValue(j_column_pivots)) {
            column_pivots = vecFromArray<t_val, std::string>(j_column_pivots);
        }

        bool column_only = false;

        if (row_pivots.size() == 0 && column_pivots.size() > 0) {
            row_pivots.push_back("psp_okey");
            column_only = true;
        }

        if (hasValue(j_sort)) {
            sortbys = vecFromArray<t_val, t_val>(j_sort);
        }

        columns = vecFromArray<t_val, std::string>(j_columns);
        aggregates = _get_aggspecs(
            schema, row_pivots, column_pivots, column_only, columns, sortbys, j_aggregates);
        aggregate_names = _get_aggregate_names(aggregates);

        if (hasValue(j_filter)) {
            filters = _get_fterms(schema, date_parser, j_filter);
            if (hasValue(config["filter_op"])) {
                filter_op = str_to_filter_op(config["filter_op"].as<std::string>());
            }
        }

        if (sortbys.size() > 0) {
            sorts = _get_sort(aggregate_names, false, sortbys);
            col_sorts = _get_sort(aggregate_names, true, sortbys);
        }

        auto view_config = t_config(row_pivots, column_pivots, aggregates, sorts, col_sorts,
            filter_op, filters, aggregate_names, column_only);

        return view_config;
    }

    template <>
    std::shared_ptr<View<t_ctx0>>
    make_view_zero(std::shared_ptr<t_pool> pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::string separator, t_val config, t_val date_parser) {
        auto schema = gnode->get_tblschema();
        t_config view_config = make_view_config<t_val>(schema, separator, date_parser, config);

        auto col_names = view_config.get_column_names();
        auto filter_op = view_config.get_combiner();
        auto filters = view_config.get_fterms();
        auto sorts = view_config.get_sortspecs();
        auto ctx = make_context_zero(
            schema, filter_op, col_names, filters, sorts, pool, gnode, name);

        auto view_ptr
            = std::make_shared<View<t_ctx0>>(pool, ctx, gnode, name, separator, view_config);

        return view_ptr;
    }

    template <>
    std::shared_ptr<View<t_ctx1>>
    make_view_one(std::shared_ptr<t_pool> pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::string separator, t_val config, t_val date_parser) {
        auto schema = gnode->get_tblschema();
        t_config view_config = make_view_config<t_val>(schema, separator, date_parser, config);

        auto aggregates = view_config.get_aggregates();
        auto row_pivots = view_config.get_row_pivots();
        auto filter_op = view_config.get_combiner();
        auto filters = view_config.get_fterms();
        auto sorts = view_config.get_sortspecs();

        std::int32_t pivot_depth = -1;
        if (hasValue(config["row_pivot_depth"])) {
            pivot_depth = config["row_pivot_depth"].as<std::int32_t>();
        }

        auto ctx = make_context_one(schema, row_pivots, filter_op, filters, aggregates, sorts,
            pivot_depth, pool, gnode, name);

        auto view_ptr
            = std::make_shared<View<t_ctx1>>(pool, ctx, gnode, name, separator, view_config);

        return view_ptr;
    }

    template <>
    std::shared_ptr<View<t_ctx2>>
    make_view_two(std::shared_ptr<t_pool> pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::string separator, t_val config, t_val date_parser) {
        auto schema = gnode->get_tblschema();
        t_config view_config = make_view_config<t_val>(schema, separator, date_parser, config);

        bool column_only = view_config.is_column_only();
        auto column_names = view_config.get_column_names();
        auto row_pivots = view_config.get_row_pivots();
        auto column_pivots = view_config.get_column_pivots();
        auto aggregates = view_config.get_aggregates();
        auto filter_op = view_config.get_combiner();
        auto filters = view_config.get_fterms();
        auto sorts = view_config.get_sortspecs();
        auto col_sorts = view_config.get_col_sortspecs();

        std::int32_t rpivot_depth = -1;
        std::int32_t cpivot_depth = -1;

        if (hasValue(config["row_pivot_depth"])) {
            rpivot_depth = config["row_pivot_depth"].as<std::int32_t>();
        }

        if (hasValue(config["column_pivot_depth"])) {
            cpivot_depth = config["column_pivot_depth"].as<std::int32_t>();
        }

        auto ctx = make_context_two(schema, row_pivots, column_pivots, filter_op, filters,
            aggregates, sorts, col_sorts, rpivot_depth, cpivot_depth, column_only, pool, gnode,
            name);

        auto view_ptr
            = std::make_shared<View<t_ctx2>>(pool, ctx, gnode, name, separator, view_config);

        return view_ptr;
    }

    /******************************************************************************
     *
     * Context API
     */

    std::shared_ptr<t_ctx0>
    make_context_zero(t_schema schema, t_filter_op combiner, std::vector<std::string> columns,
        std::vector<t_fterm> filters, std::vector<t_sortspec> sorts,
        std::shared_ptr<t_pool> pool, std::shared_ptr<t_gnode> gnode, std::string name) {
        auto cfg = t_config(columns, combiner, filters);
        auto ctx0 = std::make_shared<t_ctx0>(schema, cfg);
        ctx0->init();
        ctx0->sort_by(sorts);
        pool->register_context(gnode->get_id(), name, ZERO_SIDED_CONTEXT,
            reinterpret_cast<std::uintptr_t>(ctx0.get()));
        return ctx0;
    }

    std::shared_ptr<t_ctx1>
    make_context_one(t_schema schema, std::vector<t_pivot> pivots, t_filter_op combiner,
        std::vector<t_fterm> filters, std::vector<t_aggspec> aggregates,
        std::vector<t_sortspec> sorts, std::int32_t pivot_depth, std::shared_ptr<t_pool> pool,
        std::shared_ptr<t_gnode> gnode, std::string name) {
        auto cfg = t_config(pivots, aggregates, combiner, filters);
        auto ctx1 = std::make_shared<t_ctx1>(schema, cfg);

        ctx1->init();
        ctx1->sort_by(sorts);
        pool->register_context(gnode->get_id(), name, ONE_SIDED_CONTEXT,
            reinterpret_cast<std::uintptr_t>(ctx1.get()));

        if (pivot_depth > -1) {
            ctx1->set_depth(pivot_depth - 1);
        } else {
            ctx1->set_depth(pivots.size());
        }

        return ctx1;
    }

    std::shared_ptr<t_ctx2>
    make_context_two(t_schema schema, std::vector<t_pivot> rpivots,
        std::vector<t_pivot> cpivots, t_filter_op combiner, std::vector<t_fterm> filters,
        std::vector<t_aggspec> aggregates, std::vector<t_sortspec> sorts,
        std::vector<t_sortspec> col_sorts, std::int32_t rpivot_depth, std::int32_t cpivot_depth,
        bool column_only, std::shared_ptr<t_pool> pool, std::shared_ptr<t_gnode> gnode,
        std::string name) {
        t_totals total = sorts.size() > 0 ? TOTALS_BEFORE : TOTALS_HIDDEN;

        auto cfg
            = t_config(rpivots, cpivots, aggregates, total, combiner, filters, column_only);
        auto ctx2 = std::make_shared<t_ctx2>(schema, cfg);

        ctx2->init();
        pool->register_context(gnode->get_id(), name, TWO_SIDED_CONTEXT,
            reinterpret_cast<std::uintptr_t>(ctx2.get()));

        if (rpivot_depth > -1) {
            ctx2->set_depth(t_header::HEADER_ROW, rpivot_depth - 1);
        } else {
            ctx2->set_depth(t_header::HEADER_ROW, rpivots.size());
        }

        if (cpivot_depth > -1) {
            ctx2->set_depth(t_header::HEADER_COLUMN, cpivot_depth - 1);
        } else {
            ctx2->set_depth(t_header::HEADER_COLUMN, cpivots.size());
        }

        if (sorts.size() > 0) {
            ctx2->sort_by(sorts);
        }

        if (col_sorts.size() > 0) {
            ctx2->column_sort_by(col_sorts);
        }

        return ctx2;
    }

    /******************************************************************************
     *
     * Data serialization
     */

    template <>
    t_val
    get_column_data(std::shared_ptr<t_data_table> table, std::string colname) {
        t_val arr = t_val::array();
        auto col = table->get_column(colname);
        for (auto idx = 0; idx < col->size(); ++idx) {
            arr.set(idx, scalar_to_val(col->get_scalar(idx)));
        }
        return arr;
    }

    template <typename CTX_T>
    std::shared_ptr<t_data_slice<CTX_T>>
    get_data_slice(std::shared_ptr<View<CTX_T>> view, std::uint32_t start_row,
        std::uint32_t end_row, std::uint32_t start_col, std::uint32_t end_col) {
        auto data_slice = view->get_data(start_row, end_row, start_col, end_col);
        return data_slice;
    }

    template <typename CTX_T>
    t_val
    get_from_data_slice(
        std::shared_ptr<t_data_slice<CTX_T>> data_slice, t_uindex ridx, t_uindex cidx) {
        auto d = data_slice->get(ridx, cidx);
        return scalar_to_val(d);
    }

} // end namespace binding
} // end namespace perspective

using namespace perspective::binding;

/**
 * Main
 */
int
main(int argc, char** argv) {
    // clang-format off
EM_ASM({

    if (typeof self !== "undefined") {
        if (self.dispatchEvent && !self._perspective_initialized && self.document) {
            self._perspective_initialized = true;
            var event = self.document.createEvent("Event");
            event.initEvent("perspective-ready", false, true);
            self.dispatchEvent(event);
        } else if (!self.document && self.postMessage) {
            self.postMessage({});
        }
    }

});
    // clang-format on
}

/******************************************************************************
 *
 * Embind
 */

EMSCRIPTEN_BINDINGS(perspective) {
    /******************************************************************************
     *
     * View
     */
    // Bind a View for each context type

    class_<View<t_ctx0>>("View_ctx0")
        .constructor<std::shared_ptr<t_pool>, std::shared_ptr<t_ctx0>, std::shared_ptr<t_gnode>,
            std::string, std::string, t_config>()
        .smart_ptr<std::shared_ptr<View<t_ctx0>>>("shared_ptr<View_ctx0>")
        .function("sides", &View<t_ctx0>::sides)
        .function("num_rows", &View<t_ctx0>::num_rows)
        .function("num_columns", &View<t_ctx0>::num_columns)
        .function("get_row_expanded", &View<t_ctx0>::get_row_expanded)
        .function("schema", &View<t_ctx0>::schema)
        .function("column_names", &View<t_ctx0>::column_names)
        .function("_get_deltas_enabled", &View<t_ctx0>::_get_deltas_enabled)
        .function("_set_deltas_enabled", &View<t_ctx0>::_set_deltas_enabled)
        .function("get_context", &View<t_ctx0>::get_context, allow_raw_pointers())
        .function("get_row_pivots", &View<t_ctx0>::get_row_pivots)
        .function("get_column_pivots", &View<t_ctx0>::get_column_pivots)
        .function("get_aggregates", &View<t_ctx0>::get_aggregates)
        .function("get_filter", &View<t_ctx0>::get_filter)
        .function("get_sort", &View<t_ctx0>::get_sort)
        .function("get_step_delta", &View<t_ctx0>::get_step_delta)
        .function("get_row_delta", &View<t_ctx0>::get_row_delta)
        .function("get_column_dtype", &View<t_ctx0>::get_column_dtype)
        .function("is_column_only", &View<t_ctx0>::is_column_only);

    class_<View<t_ctx1>>("View_ctx1")
        .constructor<std::shared_ptr<t_pool>, std::shared_ptr<t_ctx1>, std::shared_ptr<t_gnode>,
            std::string, std::string, t_config>()
        .smart_ptr<std::shared_ptr<View<t_ctx1>>>("shared_ptr<View_ctx1>")
        .function("sides", &View<t_ctx1>::sides)
        .function("num_rows", &View<t_ctx1>::num_rows)
        .function("num_columns", &View<t_ctx1>::num_columns)
        .function("get_row_expanded", &View<t_ctx1>::get_row_expanded)
        .function("expand", &View<t_ctx1>::expand)
        .function("collapse", &View<t_ctx1>::collapse)
        .function("set_depth", &View<t_ctx1>::set_depth)
        .function("schema", &View<t_ctx1>::schema)
        .function("column_names", &View<t_ctx1>::column_names)
        .function("_get_deltas_enabled", &View<t_ctx1>::_get_deltas_enabled)
        .function("_set_deltas_enabled", &View<t_ctx1>::_set_deltas_enabled)
        .function("get_context", &View<t_ctx1>::get_context, allow_raw_pointers())
        .function("get_row_pivots", &View<t_ctx1>::get_row_pivots)
        .function("get_column_pivots", &View<t_ctx1>::get_column_pivots)
        .function("get_aggregates", &View<t_ctx1>::get_aggregates)
        .function("get_filter", &View<t_ctx1>::get_filter)
        .function("get_sort", &View<t_ctx1>::get_sort)
        .function("get_step_delta", &View<t_ctx1>::get_step_delta)
        .function("get_row_delta", &View<t_ctx1>::get_row_delta)
        .function("get_column_dtype", &View<t_ctx1>::get_column_dtype)
        .function("is_column_only", &View<t_ctx1>::is_column_only);

    class_<View<t_ctx2>>("View_ctx2")
        .constructor<std::shared_ptr<t_pool>, std::shared_ptr<t_ctx2>, std::shared_ptr<t_gnode>,
            std::string, std::string, t_config>()
        .smart_ptr<std::shared_ptr<View<t_ctx2>>>("shared_ptr<View_ctx2>")
        .function("sides", &View<t_ctx2>::sides)
        .function("num_rows", &View<t_ctx2>::num_rows)
        .function("num_columns", &View<t_ctx2>::num_columns)
        .function("get_row_expanded", &View<t_ctx2>::get_row_expanded)
        .function("expand", &View<t_ctx2>::expand)
        .function("collapse", &View<t_ctx2>::collapse)
        .function("set_depth", &View<t_ctx2>::set_depth)
        .function("schema", &View<t_ctx2>::schema)
        .function("column_names", &View<t_ctx2>::column_names)
        .function("_get_deltas_enabled", &View<t_ctx2>::_get_deltas_enabled)
        .function("_set_deltas_enabled", &View<t_ctx2>::_set_deltas_enabled)
        .function("get_context", &View<t_ctx2>::get_context, allow_raw_pointers())
        .function("get_row_pivots", &View<t_ctx2>::get_row_pivots)
        .function("get_column_pivots", &View<t_ctx2>::get_column_pivots)
        .function("get_aggregates", &View<t_ctx2>::get_aggregates)
        .function("get_filter", &View<t_ctx2>::get_filter)
        .function("get_sort", &View<t_ctx2>::get_sort)
        .function("get_row_path", &View<t_ctx2>::get_row_path)
        .function("get_step_delta", &View<t_ctx2>::get_step_delta)
        .function("get_row_delta", &View<t_ctx2>::get_row_delta)
        .function("get_column_dtype", &View<t_ctx2>::get_column_dtype)
        .function("is_column_only", &View<t_ctx2>::is_column_only);

    /******************************************************************************
     *
     * t_data_table
     */
    class_<t_data_table>("t_data_table")
        .smart_ptr<std::shared_ptr<t_data_table>>("shared_ptr<t_data_table>")
        .function<unsigned long>("size",
            reinterpret_cast<unsigned long (t_data_table::*)() const>(&t_data_table::size));

    /******************************************************************************
     *
     * t_schema
     */
    class_<t_schema>("t_schema")
        .function<const std::vector<std::string>&>(
            "columns", &t_schema::columns, allow_raw_pointers())
        .function<const std::vector<t_dtype>>("types", &t_schema::types, allow_raw_pointers());

    /******************************************************************************
     *
     * t_gnode
     */
    class_<t_gnode>("t_gnode")
        .smart_ptr<std::shared_ptr<t_gnode>>("shared_ptr<t_gnode>")
        .function<t_uindex>(
            "get_id", reinterpret_cast<t_uindex (t_gnode::*)() const>(&t_gnode::get_id))
        .function<t_schema>("get_tblschema", &t_gnode::get_tblschema)
        .function<void>("reset", &t_gnode::reset)
        .function<t_data_table*>("get_table", &t_gnode::get_table, allow_raw_pointers());

    /******************************************************************************
     *
     * t_data_slice
     */
    class_<t_data_slice<t_ctx0>>("t_data_slice_ctx0")
        .smart_ptr<std::shared_ptr<t_data_slice<t_ctx0>>>("shared_ptr<t_data_slice<t_ctx0>>>")
        .function<std::vector<t_tscalar>>(
            "get_column_slice", &t_data_slice<t_ctx0>::get_column_slice)
        .function<const std::vector<t_tscalar>&>("get_slice", &t_data_slice<t_ctx0>::get_slice)
        .function<const std::vector<std::vector<t_tscalar>>&>(
            "get_column_names", &t_data_slice<t_ctx0>::get_column_names);

    class_<t_data_slice<t_ctx1>>("t_data_slice_ctx1")
        .smart_ptr<std::shared_ptr<t_data_slice<t_ctx1>>>("shared_ptr<t_data_slice<t_ctx1>>>")
        .function<std::vector<t_tscalar>>(
            "get_column_slice", &t_data_slice<t_ctx1>::get_column_slice)
        .function<const std::vector<t_tscalar>&>("get_slice", &t_data_slice<t_ctx1>::get_slice)
        .function<const std::vector<std::vector<t_tscalar>>&>(
            "get_column_names", &t_data_slice<t_ctx1>::get_column_names)
        .function<std::vector<t_tscalar>>("get_row_path", &t_data_slice<t_ctx1>::get_row_path);

    class_<t_data_slice<t_ctx2>>("t_data_slice_ctx2")
        .smart_ptr<std::shared_ptr<t_data_slice<t_ctx2>>>("shared_ptr<t_data_slice<t_ctx2>>>")
        .function<std::vector<t_tscalar>>(
            "get_column_slice", &t_data_slice<t_ctx2>::get_column_slice)
        .function<const std::vector<t_tscalar>&>("get_slice", &t_data_slice<t_ctx2>::get_slice)
        .function<const std::vector<std::vector<t_tscalar>>&>(
            "get_column_names", &t_data_slice<t_ctx2>::get_column_names)
        .function<std::vector<t_tscalar>>("get_row_path", &t_data_slice<t_ctx2>::get_row_path);

    /******************************************************************************
     *
     * t_ctx0
     */
    class_<t_ctx0>("t_ctx0").smart_ptr<std::shared_ptr<t_ctx0>>("shared_ptr<t_ctx0>");

    /******************************************************************************
     *
     * t_ctx1
     */
    class_<t_ctx1>("t_ctx1").smart_ptr<std::shared_ptr<t_ctx1>>("shared_ptr<t_ctx1>");

    /******************************************************************************
     *
     * t_ctx2
     */
    class_<t_ctx2>("t_ctx2").smart_ptr<std::shared_ptr<t_ctx2>>("shared_ptr<t_ctx2>");

    /******************************************************************************
     *
     * t_pool
     */
    class_<t_pool>("t_pool")
        .constructor<>()
        .smart_ptr<std::shared_ptr<t_pool>>("shared_ptr<t_pool>")
        .function<void>("unregister_gnode", &t_pool::unregister_gnode)
        .function<void>("_process", &t_pool::_process)
        .function<void>("set_update_delegate", &t_pool::set_update_delegate);

    /******************************************************************************
     *
     * t_tscalar
     */
    class_<t_tscalar>("t_tscalar");

    /******************************************************************************
     *
     * t_updctx
     */
    value_object<t_updctx>("t_updctx")
        .field("gnode_id", &t_updctx::m_gnode_id)
        .field("ctx_name", &t_updctx::m_ctx);

    /******************************************************************************
     *
     * t_cellupd
     */
    value_object<t_cellupd>("t_cellupd")
        .field("row", &t_cellupd::row)
        .field("column", &t_cellupd::column)
        .field("old_value", &t_cellupd::old_value)
        .field("new_value", &t_cellupd::new_value);

    /******************************************************************************
     *
     * t_stepdelta
     */
    value_object<t_stepdelta>("t_stepdelta")
        .field("rows_changed", &t_stepdelta::rows_changed)
        .field("columns_changed", &t_stepdelta::columns_changed)
        .field("cells", &t_stepdelta::cells);

    /******************************************************************************
     *
     * vector
     */
    register_vector<std::int32_t>("std::vector<std::int32_t>");
    register_vector<t_dtype>("std::vector<t_dtype>");
    register_vector<t_cellupd>("std::vector<t_cellupd>");
    register_vector<t_tscalar>("std::vector<t_tscalar>");
    register_vector<std::vector<t_tscalar>>("std::vector<std::vector<t_tscalar>>");
    register_vector<std::string>("std::vector<std::string>");
    register_vector<t_updctx>("std::vector<t_updctx>");
    register_vector<t_uindex>("std::vector<t_uindex>");

    /******************************************************************************
     *
     * map
     */
    register_map<std::string, std::string>("std::map<std::string, std::string>");

    /******************************************************************************
     *
     * t_dtype
     */
    enum_<t_dtype>("t_dtype")
        .value("DTYPE_NONE", DTYPE_NONE)
        .value("DTYPE_INT64", DTYPE_INT64)
        .value("DTYPE_INT32", DTYPE_INT32)
        .value("DTYPE_INT16", DTYPE_INT16)
        .value("DTYPE_INT8", DTYPE_INT8)
        .value("DTYPE_UINT64", DTYPE_UINT64)
        .value("DTYPE_UINT32", DTYPE_UINT32)
        .value("DTYPE_UINT16", DTYPE_UINT16)
        .value("DTYPE_UINT8", DTYPE_UINT8)
        .value("DTYPE_FLOAT64", DTYPE_FLOAT64)
        .value("DTYPE_FLOAT32", DTYPE_FLOAT32)
        .value("DTYPE_BOOL", DTYPE_BOOL)
        .value("DTYPE_TIME", DTYPE_TIME)
        .value("DTYPE_DATE", DTYPE_DATE)
        .value("DTYPE_ENUM", DTYPE_ENUM)
        .value("DTYPE_OID", DTYPE_OID)
        .value("DTYPE_PTR", DTYPE_PTR)
        .value("DTYPE_F64PAIR", DTYPE_F64PAIR)
        .value("DTYPE_USER_FIXED", DTYPE_USER_FIXED)
        .value("DTYPE_STR", DTYPE_STR)
        .value("DTYPE_USER_VLEN", DTYPE_USER_VLEN)
        .value("DTYPE_LAST_VLEN", DTYPE_LAST_VLEN)
        .value("DTYPE_LAST", DTYPE_LAST);

    /******************************************************************************
     *
     * t_op
     */
    enum_<t_op>("t_op")
        .value("OP_INSERT", OP_INSERT)
        .value("OP_DELETE", OP_DELETE)
        .value("OP_CLEAR", OP_CLEAR)
        .value("OP_UPDATE", OP_UPDATE);

    /******************************************************************************
     *
     * assorted functions
     */
    function("make_data_table", &make_data_table<t_val>);
    function("make_pool", &make_pool);
    function("clone_gnode_table", &clone_gnode_table<t_val>);
    function("scalar_vec_to_val", &scalar_vec_to_val);
    function("scalar_vec_to_string", &scalar_vec_to_string);
    function("table_add_computed_column", &table_add_computed_column<t_val>);
    function("col_to_js_typed_array", &col_to_js_typed_array);
    function("make_view_zero", &make_view_zero<t_val>);
    function("make_view_one", &make_view_one<t_val>);
    function("make_view_two", &make_view_two<t_val>);
    function("get_data_slice_zero", &get_data_slice<t_ctx0>, allow_raw_pointers());
    function("get_from_data_slice_zero", &get_from_data_slice<t_ctx0>, allow_raw_pointers());
    function("get_data_slice_one", &get_data_slice<t_ctx1>, allow_raw_pointers());
    function("get_from_data_slice_one", &get_from_data_slice<t_ctx1>, allow_raw_pointers());
    function("get_data_slice_two", &get_data_slice<t_ctx2>, allow_raw_pointers());
    function("get_from_data_slice_two", &get_from_data_slice<t_ctx2>, allow_raw_pointers());
}