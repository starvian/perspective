/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import {Lexer, createToken, tokenMatcher} from "chevrotain";
import {PerspectiveLexerErrorMessage} from "./error";
import {clean_tokens, Comma, ColumnName, As, Whitespace, LeftParen, RightParen, OperatorTokenType, FunctionTokenType, UpperLowerCaseTokenType, ColumnNameTokenType} from "./lexer";
import {ComputedExpressionColumnParser} from "./parser";
import {COMPUTED_FUNCTION_FORMATTERS} from "./formatter";

const token_types = {FunctionTokenType, OperatorTokenType};

class PerspectiveComputedExpressionParser {
    constructor() {
        this.is_initialized = false;
        this._vocabulary = {};
        this._tokens = [Whitespace, Comma, As, ColumnName, LeftParen, RightParen];
        this._metadata;
        this._lexer;
        this._parser;
        this._visitor;
    }

    init(metadata) {
        if (this.is_initialized) {
            return;
        }

        // Add base tokens to the vocabulary
        for (const token of this._tokens) {
            this._vocabulary[token.name] = token;
        }

        // Computed function metadata from the Perspective table
        this._metadata = metadata;

        // Initialize lexer, parser, and visitor
        this._construct_lexer();
        this._construct_parser();
        this._construct_visitor();

        this.is_initialized = true;
    }

    /**
     * Given an expression, transform it into a list of tokens.
     *
     * @param {String} expression
     */
    lex(expression) {
        this._check_initialized();
        const result = this._lexer.tokenize(expression);

        if (result.errors.length > 0) {
            let message = result.errors[0].message;
            throw new Error(message);
        }

        // Remove whitespace tokens
        result.tokens = clean_tokens(result.tokens);

        return result;
    }

    /**
     * Given a string expression of the form '"column" +, -, *, / "column",
     * parse it and return a computed column configuration object.
     *
     * @param {String} expression
     */
    parse(expression) {
        this._check_initialized();
        const lex_result = this.lex(expression);

        // calling `parser.input` resets state.
        this._parser.input = lex_result.tokens;

        const cst = this._parser.SuperExpression();

        if (this._parser.errors.length > 0) {
            let message = this._parser.errors[0].message;
            throw new Error(message);
        }

        return this._visitor.visit(cst);
    }

    /**
     * Given a lexer result and the raw expression that was lexed,
     * suggest syntactically possible tokens. If the last non-whitespace/comma
     * token is a column name, only show operators that take the correct type.
     *
     * @param {ILexingResult} lexer_result
     * @param {String} expression
     * @returns {Array}
     */
    get_autocomplete_suggestions(expression, lexer_result) {
        this._check_initialized();
        let initial_suggestions = this._parser.computeContentAssist("SuperExpression", []);

        if (!lexer_result) {
            return this._apply_suggestion_metadata(initial_suggestions);
        }

        if (lexer_result.errors.length > 0) {
            // Check if the last token is partial AND not a column name (not in
            // quotes). If true, the suggest function names that match.
            const partial_function = this.extract_partial_function(expression);

            if (partial_function && partial_function.search(/["']$/) === -1) {
                // Remove open parenthesis and column name rule
                const suggestions = this._apply_suggestion_metadata(initial_suggestions.slice(2));
                return suggestions.filter(s => s.value.startsWith(partial_function));
            } else {
                // Expression has unrecoverable errors
                return [];
            }
        }

        // Remove whitespace tokens
        lexer_result.tokens = clean_tokens(lexer_result.tokens);
        const suggestions = this._parser.computeContentAssist("SuperExpression", lexer_result.tokens);
        return this._apply_suggestion_metadata(suggestions);
    }

    /**
     * Try to extract a function name from the expression by backtracking until
     * we hit the last open parenthesis or comma.
     *
     * Because all functions need to be parenthesis-wrapped unless at the
     * beginning of the expression, simply checking for parenthesis is enough
     * to get a partial from common expressions:
     *
     * - "Sales" + (s => ["sqrt"]
     * - "(a" => ["abs"]
     *
     * @param {String} expression
     */
    extract_partial_function(expression) {
        this._check_initialized();
        const paren_index = expression.lastIndexOf("(");
        const comma_index = expression.lastIndexOf(",");

        if (comma_index > paren_index) {
            // i.e. concat_comma("Sales",
            return expression.substring(comma_index).replace(",", "");
        } else if (paren_index === -1) {
            // If it can't find a parenthesis, and there are no column names,
            // return the entire expression. Otherwise, a partial function
            // could not be found, so return undefined.
            if (expression.search(/["']/) === -1) {
                return expression;
            } else {
                return undefined;
            }
        } else {
            // i.e. '"Sales" + (sqr', remove the parenthesis so the pattern
            // can be matched.
            return expression.substring(paren_index).replace("(", "");
        }
    }

    /**
     * Look backwards through a list of tokens for a function or operator,
     * stopping after `limit` tokens. Whitespace tokens are removed from the
     * token list before the search.
     *
     * @param {ILexingResult} lexer_result A result from the lexer, containing
     * valid tokens and errors.
     * @param {*} limit the number of tokens to search through before
     * exiting or returning a valid result. If limit > tokens.length or is
     * undefined, search all tokens.
     */
    get_last_function_or_operator(lexer_result, limit) {
        const tokens = clean_tokens(lexer_result.tokens);
        if (!limit || limit <= 0 || limit >= tokens.length) {
            limit = tokens.length;
        }
        for (let i = tokens.length - 1; i >= tokens.length - limit; i--) {
            if (tokenMatcher(tokens[i], FunctionTokenType) || tokenMatcher(tokens[i], OperatorTokenType)) {
                return tokens[i];
            }
        }
    }

    /**
     * Look backwards through a list of tokens for a column name, stopping after
     * `limit` tokens. Whitespace tokens are removed from the token list
     * before the search.
     *
     * @param {ILexingResult} lexer_result A result from the lexer, containing
     * valid tokens and errors.
     * @param {Number} limit the number of tokens to search through before
     * exiting or returning a valid result. If limit > tokens.length or is
     * undefined, search all tokens.
     */
    get_last_column_name(lexer_result, limit) {
        const tokens = clean_tokens(lexer_result.tokens);
        if (!limit || limit <= 0 || limit >= tokens.length) {
            limit = tokens.length;
        }
        for (let i = tokens.length - 1; i >= tokens.length - limit; i--) {
            if (tokenMatcher(tokens[i], ColumnNameTokenType)) {
                return tokens[i];
            }
        }
    }

    /**
     * Given a metadata object containing information about computed
     * functions, construct tokens and a vocabulary object for the parser.
     */
    _construct_lexer() {
        const bin_functions = ["bin1000th", "bin1000", "bin100th", "bin100", "bin10th", "bin10"];

        for (const key in this._metadata) {
            const meta = this._metadata[key];

            if (bin_functions.includes(meta.name)) {
                continue;
            }

            const token = this._make_token(meta);
            this._tokens.push(token);
            this._vocabulary[token.name] = token;
        }

        // Create and add bin functions in a specific order for the parser
        for (const bin_function of bin_functions) {
            const meta = this._metadata[bin_function];
            const token = this._make_token(meta);
            this._tokens.push(token);
            this._vocabulary[token.name] = token;
        }

        // Add uppercase/lowercase token last so it does not conflict
        this._tokens.push(UpperLowerCaseTokenType);
        this._vocabulary[UpperLowerCaseTokenType.name] = UpperLowerCaseTokenType;

        this._lexer = new Lexer(this._tokens, {
            errorMessageProvider: PerspectiveLexerErrorMessage
        });
    }

    /**
     * Convenience method to create a Chevrotain token.
     *
     * @param {Object} meta
     */
    _make_token(meta) {
        const regex = new RegExp(meta.pattern);

        const token = createToken({
            name: meta.name,
            label: meta.label,
            pattern: regex,
            categories: [token_types[meta.category]]
        });

        token.return_type = meta.return_type;

        // float/int and date/datetime are interchangable
        if (meta.input_type === "float") {
            token.input_types = ["float", "integer"];
        } else if (meta.input_type === "datetime") {
            token.input_types = ["datetime", "date"];
        } else {
            token.input_types = [meta.input_type];
        }

        return token;
    }

    /**
     * Construct a singleton parser instance that will be reused.
     */
    _construct_parser() {
        this._parser = new ComputedExpressionColumnParser(this._vocabulary);
    }

    /**
     * Define and construct a singleton visitor instance.
     */
    _construct_visitor() {
        const base_visitor = this._parser.getBaseCstVisitorConstructor();

        // The visitor has to be defined inside this method, as it requires
        // base_visitor from the parser instance
        class ComputedExpressionColumnVisitor extends base_visitor {
            constructor() {
                super();
                this.validateVisitor();
            }

            SuperExpression(ctx) {
                let computed_columns = [];
                this.visit(ctx.Expression, computed_columns);
                return computed_columns;
            }

            Expression(ctx, computed_columns) {
                if (ctx.OperatorComputedColumn) {
                    this.visit(ctx.OperatorComputedColumn, computed_columns);
                } else if (ctx.FunctionComputedColumn) {
                    this.visit(ctx.FunctionComputedColumn, computed_columns);
                } else {
                    return;
                }
            }

            /**
             * Visit a single computed column in operator notation and generate
             * its specification.
             *
             * @param {*} ctx
             */
            OperatorComputedColumn(ctx, computed_columns) {
                let left = this.visit(ctx.left, computed_columns);

                if (typeof left === "undefined") {
                    left = computed_columns[computed_columns.length - 1].column;
                }

                let operator = this.visit(ctx.Operator);

                if (!operator) {
                    return;
                }

                let right = this.visit(ctx.right, computed_columns);

                if (typeof right === "undefined") {
                    right = computed_columns[computed_columns.length - 1].column;
                }

                let as = this.visit(ctx.as);

                let column_name = COMPUTED_FUNCTION_FORMATTERS[operator](left, right);

                // Use custom name if provided through `AS/as/As`
                if (as) {
                    column_name = as;
                }

                computed_columns.push({
                    column: column_name,
                    computed_function_name: operator,
                    inputs: [left, right]
                });
            }

            /**
             * Visit a single computed column in functional notation and
             * generate its specification.
             *
             * @param {*} ctx
             * @param {*} computed_columns
             */
            FunctionComputedColumn(ctx, computed_columns) {
                const fn = this.visit(ctx.Function);

                // Functions have 1...n parameters
                let input_columns = [];

                for (const column_name of ctx.ColumnName) {
                    let column = this.visit(column_name, computed_columns);
                    if (typeof column === "undefined") {
                        // Use the column immediately to the left, as that is
                        // the name of the parsed column from the expression
                        input_columns.push(computed_columns[computed_columns.length - 1].column);
                    } else {
                        input_columns.push(column);
                    }
                }

                const as = this.visit(ctx.as);

                let column_name = COMPUTED_FUNCTION_FORMATTERS[fn](...input_columns);

                // Use custom name if provided through `AS/as/As`
                if (as) {
                    column_name = as;
                }

                const computed = {
                    column: column_name,
                    computed_function_name: fn,
                    inputs: input_columns
                };

                computed_columns.push(computed);
            }

            /**
             * Parse and return a column name to be included in the computed
             * config.
             * @param {*} ctx
             */
            ColumnName(ctx, computed_columns) {
                // `image` contains the raw string, `payload` contains the
                // string without quotes.
                if (ctx.ParentheticalExpression) {
                    return this.visit(ctx.ParentheticalExpression, computed_columns);
                } else {
                    return ctx.columnName[0].payload;
                }
            }

            /**
             * Parse and return a column name to be included in the computed
             * config, and explicitly not parsed as a parenthetical expression.
             *
             * @param {*} ctx
             */
            TerminalColumnName(ctx) {
                return ctx.columnName[0].payload;
            }

            /**
             * Parse a single mathematical operator (+, -, *, /, %).
             * @param {*} ctx
             */
            Operator(ctx) {
                if (ctx.add) {
                    return ctx.add[0].image;
                } else if (ctx.subtract) {
                    return ctx.subtract[0].image;
                } else if (ctx.multiply) {
                    return ctx.multiply[0].image;
                } else if (ctx.divide) {
                    return ctx.divide[0].image;
                } else if (ctx.pow) {
                    return ctx.pow[0].image;
                } else if (ctx.percent_of) {
                    return ctx.percent_of[0].image;
                } else if (ctx.equals) {
                    return ctx.equals[0].image;
                } else if (ctx.not_equals) {
                    return ctx.not_equals[0].image;
                } else if (ctx.greater_than) {
                    return ctx.greater_than[0].image;
                } else if (ctx.less_than) {
                    return ctx.less_than[0].image;
                } else if (ctx.is) {
                    return ctx.is[0].image;
                } else {
                    return;
                }
            }

            /**
             * Identify and return a function name used for computation.
             *
             * @param {*} ctx
             */
            Function(ctx) {
                if (ctx.sqrt) {
                    return ctx.sqrt[0].image;
                } else if (ctx.pow2) {
                    return ctx.pow2[0].image;
                } else if (ctx.abs) {
                    return ctx.abs[0].image;
                } else if (ctx.invert) {
                    return ctx.invert[0].image;
                } else if (ctx.log) {
                    return ctx.log[0].image;
                } else if (ctx.exp) {
                    return ctx.exp[0].image;
                } else if (ctx.length) {
                    return ctx.length[0].image;
                } else if (ctx.uppercase) {
                    return ctx.uppercase[0].image;
                } else if (ctx.lowercase) {
                    return ctx.lowercase[0].image;
                } else if (ctx.concat_comma) {
                    return ctx.concat_comma[0].image;
                } else if (ctx.concat_space) {
                    return ctx.concat_space[0].image;
                } else if (ctx.bin10) {
                    return ctx.bin10[0].image;
                } else if (ctx.bin100) {
                    return ctx.bin100[0].image;
                } else if (ctx.bin1000) {
                    return ctx.bin1000[0].image;
                } else if (ctx.bin10th) {
                    return ctx.bin10th[0].image;
                } else if (ctx.bin100th) {
                    return ctx.bin100th[0].image;
                } else if (ctx.bin1000th) {
                    return ctx.bin1000th[0].image;
                } else if (ctx.hour_of_day) {
                    return ctx.hour_of_day[0].image;
                } else if (ctx.day_of_week) {
                    return ctx.day_of_week[0].image;
                } else if (ctx.month_of_year) {
                    return ctx.month_of_year[0].image;
                } else if (ctx.second_bucket) {
                    return ctx.second_bucket[0].image;
                } else if (ctx.minute_bucket) {
                    return ctx.minute_bucket[0].image;
                } else if (ctx.hour_bucket) {
                    return ctx.hour_bucket[0].image;
                } else if (ctx.day_bucket) {
                    return ctx.day_bucket[0].image;
                } else if (ctx.week_bucket) {
                    return ctx.week_bucket[0].image;
                } else if (ctx.month_bucket) {
                    return ctx.month_bucket[0].image;
                } else if (ctx.year_bucket) {
                    return ctx.year_bucket[0].image;
                } else {
                    return;
                }
            }

            /**
             * Give a custom name to the created computed column using "AS"
             * or "as".
             *
             * @param {*} ctx
             */
            As(ctx) {
                return ctx.TerminalColumnName[0].children.columnName[0].payload;
            }

            /**
             * Parse an expression inside parentheses through recursing back
             * up to `Expression`.
             *
             * @param {*} ctx
             * @param {*} computed_columns
             */
            ParentheticalExpression(ctx, computed_columns) {
                return this.visit(ctx.Expression, computed_columns);
            }
        }

        this._visitor = new ComputedExpressionColumnVisitor();
    }

    /**
     * Given a list of suggestions, transform each suggestion into an object
     * with `label` and `value`.
     *
     * @param {*} suggestions
     */
    _apply_suggestion_metadata(suggestions) {
        this._check_initialized();
        const suggestions_with_metadata = [];

        for (const suggestion of suggestions) {
            if (!suggestion.nextTokenType || !suggestion.nextTokenType.PATTERN.source) {
                continue;
            }

            const label = suggestion.nextTokenType.LABEL;
            let value = suggestion.nextTokenType.PATTERN.source.replace(/\\/g, "");

            if (tokenMatcher(suggestion.nextTokenType, FunctionTokenType)) {
                value = `${value}(`;
            } else if (tokenMatcher(suggestion.nextTokenType, OperatorTokenType)) {
                value = `${value} `;
            }

            suggestions_with_metadata.push({
                label,
                value
            });
        }

        return suggestions_with_metadata;
    }

    _check_initialized() {
        if (this.is_initialized === false) {
            throw new Error("PerspectiveComputedExpressionParser is not initialized!");
        }
    }
}

// Create a module-level singleton parser.
export const COMPUTED_EXPRESSION_PARSER = new PerspectiveComputedExpressionParser();
