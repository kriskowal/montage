
var Montage = require("./core").Montage;
var Observers = require("frb/observers");

// TODO manage the query portion of the path from the location controller.  it
// should pass to a terminal component, or have parts pared off at each state
// of a route per request.

/**
 * A `Router` accepts a route table and uses that table to coordinate two-way
 * bindings between its `path` and `state` properties. The `path` is the
 * unrouted portion of the window location, either from a `LocationController`
 * or the `state.remainingPath` property of an owner component's router. The
 * `state` property is suitable for controlling a navigator component, which
 * uses the `destination`, `parameters`, and `remainingPath` properties of the
 * `state` to determine which view to show (`destination`), what model to show
 * (`parameters`), and optionally passes an unprocessed portion of the path to
 * the view (`remainingPath`).
 *
 * The routing table itself is a simple `Object` that maps Sinatra-alike route
 * patterns to corresponding `desintation` names, typically the name of a view
 * component for a particular model. The variables in the route pattern
 * typically correspond to query parameters to grab particular instances of the
 * model.
 *
 * The router supports the following types of variables, denoted by their
 * prefix in the route pattern syntax.
 *
 * -    `:` for string parameters that do not include `/`
 * -    `*` for string parameters that may include `/`
 * -    `+` for whole number parameters, including only digits and
 *      automatically coerced to numbers
 *
 * The prefix may be followed by a `name`. If the name is omitted, the variable
 * populates a parameter based on its 0-based position within the pattern.
 *
 * The variable may end with a `?` if it is optional, or `&` if it corresponds
 * to an array of values delimited by `&`. In either of these cases, if the
 * variable is preceded by a `/`, that slash becomes optional.
 *
 * A pattern may end with `...` indicating that the route may have following
 * terms for the designated view, which can be bound to `state.remainingPath`.
 *
 * @classdesc Manages two-way bindings between a partial URL `path` and the
 * corresponding application MVC `state` through a Sinatra-alike routing table.
 */
exports.Router = Montage.specialize({

    constructor: {
        value: function Router(prefix, routes, insensitive) {
            var table = this.table = [];
            var backTable = this.backTable = {};
            var termsForDestination = this.termsForDestination = {};
            var patterns = Object.keys(routes);
            for (var i = 0; i < patterns.length; i++) {
                var pattern = patterns[i];
                var destination = routes[pattern];
                var route = compile(prefix + pattern, destination, insensitive);
                table.push(route);
                backTable[destination] = backTable[destination] || [];
                backTable[destination].push(route);
                var variables = route.variables;
                var terms = termsForDestination[destination] = termsForDestination[destination] || {};
                for (var j = 0; j < variables.length; j++) {
                    var term = variables[j];
                    terms[term.name] = term;
                }
            }
        }
    },

    parse: {
        value: function (path) {
            var table = this.table;
            for (var i = 0; i < table.length; i++) {
                var route = table[i];
                var match = route.match(path);
                if (match) {
                    return match;
                }
            }
        }
    },

    stringify: {
        value: function (state) {
            var table = this.backTable[state.destination];
            if (!table) {
                throw new Error("No routes for the destination: " + JSON.stringify(state.destination));
            }
            for (var i = table.length - 1; i >= 0; i--) {
                var route = table[i];
                var terms = route.terms;
                var parts = [];
                for (var j = 0; j < terms.length; j++) {
                    var term = terms[j];
                    if (term.type === "literal") {
                        parts.push(term.value);
                    } else if (state.parameters != null && state.parameters[term.name] != null) {
                        if (term.slash) {
                            parts.push("/");
                        }
                        if (term.plural) {
                            parts.push(
                                state.parameters[term.name]
                                .map(encodeURIComponent)
                                .join("&")
                            );
                        } else {
                            parts.push("" + state.parameters[term.name]);
                        }
                    } else if (term.plural && term.slash) {
                        parts.push("/");
                    }
                }
                return parts.join("") + (state.remainingPath || "");
            }
        }
    },

    observePath: {
        value: function (emit, scope) {
            var self = this;
            var state = scope.value;
            return Observers.observeProperty(state, "parameters", function changeParameters(parameters) {
                return Observers.observeProperty(state, "remainingPath", function changePath(remainingPath) {
                    return Observers.observeProperty(state, "destination", function changeDestination(destination) {
                        var terms = self.termsForDestination[destination];
                        if (!terms) {
                            return emit();
                        }
                        var names = Object.keys(terms);
                        if (!names) {
                            return emit();
                        }
                        var cancelers = names.map(function changeParameter(name) {
                            if (!name) {
                                return emit();
                            }
                            var term = terms[name];
                            return Observers.observeProperty(parameters, name, function (value) {
                                if (term.plural && value != null) {
                                    return Observers.observeRangeChange(value, function () {
                                        return emit(self.stringify(state));
                                    }, scope);
                                } else {
                                    return emit(self.stringify(state));
                                }
                            }, scope);
                        });
                    }, scope);
                }, scope);
            }, scope);
        }
    },

});

function compile(pattern, destination, insensitive) {
    var variables = [];
    var terms = [];
    var regExp = compileRegExp(pattern, variables, terms);
    return {
        variables: variables,
        terms: terms,
        match: function (path) {
            var match = regExp.exec(path)
            if (match) {
                var parameters = {};
                var remainingPath;
                for (var i = 0; i < variables.length; i++) {
                    var variable = variables[i];
                    var value = match[i + 1] || "";
                    if (variable.plural) {
                        var values;
                        if (value === "") {
                            values = [];
                        } else {
                            values = value.split("&").map(decodeURIComponent);
                            if (variable.numeric) {
                                values = values.map(function (term) {
                                    return parseInt(term, 10);
                                });
                            }
                        }
                        parameters[variable.name] = values;
                    } else {
                        if (variable.numeric) {
                            value = parseInt(value, 10);
                        }
                        if (variable.prefix === "...") {
                            remainingPath = value;
                        } else {
                            parameters[variable.name] = value;
                        }
                    }
                }
                return {
                    destination: destination,
                    parameters: parameters,
                    path: remainingPath
                };
            }
        }
    };
}

var expression = new RegExp(
    "(/?)" + // leading "slash", rendered optional if following term is optional
    "(?:" +
        ":" +
        "([:*+&])" + // "escape"
    "|" +
        "(" + // "prefix"
            ":|" + // name === "colon": should be escaped
            "\\*|" + // name === "*": slash string
            "\\+|" + // name === "+": integer
            "\\.\\.\\." + // name === "...": elision for remaining path
        ")" +
        "(\\w*)" + // "name", optional
        "([?&]|)" + // "suffix" "?" for optional, "&" for plural
    "|" +
        "([-[\\]{}()*+.\\^$|,#\\s])" + // "special" regular expression escapes
    "|" +
        "([^/:*+.&]+)" + // "literal" (expanse of non-significant characters)
    ")",
    "g"
);
function compileRegExp(pattern, variables, terms, insensitive) {
    var i = 0;
    var re = pattern.replace(expression, function (
        part,
        slash,
        escape,
        prefix,
        name,
        suffix,
        special,
        literal
    ) {
        if (prefix) { // name, slash, optional, numeric
            var variable = {
                type: "variable",
                prefix: prefix,
                name: name || i++,
                numeric: prefix === "+",
                optional: suffix === "?",
                plural: suffix === "&",
                slash: !!slash
            };
            variables.push(variable);
            terms.push(variable);
            if (prefix === "...") {
                terms.push({
                    type: "path"
                });
                return (
                    "(" +
                        (slash ? "/?" : "") +
                        ".*" +
                    ")"
                );
            } else if (suffix === "&") { // plural
                var term = (
                    (
                        prefix === "+" ?
                        "\\d+" : // numeric
                        prefix === "*" ?
                        "[^&]*" : // wildcard across path boundaries
                        "[^/&]*" // wildcard that does not cross
                    )
                );
                return (
                    "(?:" +
                        (slash || "") + // "/" or ""
                        "(" +
                            term + "(?:\\&" + term + ")*|" +
                        ")" +
                    ")?"
                );
            } else {
                return (
                    "(?:" +
                        (slash || "") + // "/" or ""
                        (
                            prefix === "+" ?
                            "(\\d+)" : // numeric
                            prefix === "*" ?
                            "(.*)" : // wildcard across path boundaries
                            "([^/]*)" // wildcard that does not cross
                        ) +
                    ")" +
                    (suffix === "?" ? "?" : "") // optional
                );
            }
        } else if (escape) {
            terms.push({
                type: "literal",
                value: slash + escape
            });
            return slash + "\\" + escape;
        } else if (literal) {
            terms.push({
                type: "literal",
                value: slash + literal
            });
            return slash + literal;
        } else if (special) {
            terms.push({
                type: "literal",
                value: slash + special
            });
            return slash + "\\" + special;
        } else {
            terms.push({
                type: "literal",
                value: slash + literal
            });
            return slash + literal;
        }
    });
    return new RegExp('^' + re + '$', !insensitive ? '' : 'i');
};

