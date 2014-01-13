
var Montage = require("./core").Montage;
var Router = require("./router").Router;
var Observers = require("frb/observers");
var Scope = require("frb/scope");

// TODO manage the query/search portion of the path.

/**
 * A `RouterController` binds a URL fragment, the `path`, to the corresponding
 * component state including the `desintation`, `parameters` object, and any
 * `remainingPath` if the route matches an ellision.
 *
 * **Reactivity**: The router controller reacts to all changes including, route
 * table changes (the `routes` property, but not its content), route table
 * parameter changes (`prefix` and `caseInsensitive`), path property changes,
 * state property changes, state destination property changes, state parameters
 * property changes, changes to parameter properties relevant to the selected
 * route, the array content of plural parameters on the selected route, and the
 * `remainingPath` if the current route ends with an ellision.
 *
 * Routes are tested in order for the first match. At this time, the route
 * controller has not been optimized to check for common prefixes, but route
 * controllers can be nested by binding the `remainingPath` of a parent to the
 * `path` of a child along a route that ends with `...`.
 *
 * A typical configuration will have a `LocationController` and a
 * `RouteController` in its root component, with the `path` of the
 * `LocationController` bound to the `path` of the `RouteController`. The top
 * level component will then show different views depending on the
 * `state.destination` of the `RouteController`, binding various
 * `state.parameters` and `state.remainingPath` to properties of the shown
 * component. A `Substition` is a good tool for alternating views.
 *
 * See `Router` for details about route tables and the meanings of the
 * `caseInsensitive` and `prefix` parameters.
 *
 * @classdesc Produces a two way binding between a `path` and the corresponding
 * `state` through a given route table.
 * @see Router
 * @see LocationController
 * @see Substitution
 */
exports.RouteController = Montage.specialize({

    constructor: {
        value: function RouteController() {
            this.super();
            this.addPathChangeListener("prefix", this, "_considerRouterChange");
            this.addPathChangeListener("caseInsensitive", this, "_considerRouterChange");
            this.addPathChangeListener("routes", this, "_considerRouterChange");
            this.routes = null;
            this.path = null;
            this.state = null;
            this._router = null;
        }
    },

    /**
     * A common prefix for all routes in the `routes` table.
     * @type {string}
     * @see Router
     * @see RouteController#routes
     */
    prefix: {
        value: ""
    },

    /**
     * Whether all routes in the route table will match imprecise
     * capitalization.
     * This property is bindable.
     * @type {boolean}
     * @see Router
     * @see RouteController#routes
     */
    caseInsensitive: {
        value: false
    },

    /**
     * An object that maps route patterns to destinations.
     *
     * The route controller reacts to changes to this property, but adding and
     * removing properties to the routes object has no effect. This can be
     * overcome by manually dispatching a "routes" property change on the
     * controller, but route tables do not typically change.
     *
     * @example
     * {
     *     "photos/": "photos",
     *     "photos/:photoId": "photo",
     *     "photos/:photoId/comments/:commentId": "photo-comment",
     *     "comments/:commentId?": "comments"
     * }
     * @type {Object}
     * @see Router
     */
    routes: {
        value: null
    },

    /**
     * The path corresponding to the current route. The path reacts to deep
     * changes on the state, including destination changes, parameter changes,
     * parameter content changes, and the changes to the remainingPath,
     * depending on the route that matches the state.
     *
     * @type {string}
     * @see Router
     */
    path: {
        value: null
    },

    /**
     * An object with `destination`, `parameters`, and `remainingPath`
     * properties with values corresponding to the `path` and the first route
     * it matches. The `state` reacts to changes to `path`.
     *
     * - The `destination` is the value corresponding to the first matching
     *   path in the `routes` table.
     * - The `parameters` is an object that has a property for every variable
     *   in the first matching path in the `routes` table. The values may be
     *   strings, numbers, or arrays of either depending on the syntax of the
     *   route.
     * - The `remainingPath` is the unmatched tail of `path` if the first
     *   matching route ends with `...`.
     *
     * @see Router
     */
    state: {
        value: null
    },

    _considerRouterChange: {
        value: function () {
            if (this._cancelPathObserver) {
                this._cancelPathObserver();
            }
            if (this._cancelStateObserver) {
                this._cancelStateObserver();
            }
            if (this.caseInsensitive == null  || this.prefix == null || this.routes == null) {
                this._router = null;
            } else {
                var router = this._router = new Router(this.prefix, this.routes, this.caseInsensitive);
                var self = this;
                var scope = new Scope(this);
                this._cancelPathObserver = Observers.observeProperty(this, "path", function (path) {
                    if (path == null) { return; }
                    if (!self._inFlux) {
                        self._inFlux = true;
                        try {
                            self.state = router.parse(path);
                        } finally {
                            self._inFlux = false;
                        }
                    }
                }, scope);
                this._cancelStateObserver = Observers.observeProperty(this, "state", function (state) {
                    return router.observePath(function (path) {
                        if (!self._inFlux) {
                            self._inFlux = true;
                            try {
                                self.path = path;
                            } finally {
                                self._inFlux = false;
                            }
                        }
                    }, scope.nest(state));
                }, scope);
            }
        }
    },

});

