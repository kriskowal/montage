
var Montage = require("./core").Montage;

var hashbang = /#!\/(.*)/;

/**
 * The `LocationController` binds the containing window location to internal
 * application state through a `path` and `query` properties. The `path`
 * contains the relevant portion of the location pertaining to application
 * state.
 *
 * The `LocationController` has two modes of use. In development it is most
 * practical to use the hash portion of the URL for the `path`, following the
 * hashbang, `#!/`, notation and may include a query, after `?`. This is the
 * mode used by default.
 *
 * In production, the page may include a `<base>` tag indicating the portion of
 * the page’s location that preceeds the `path`. This is useful in conjunction
 * with a back end service or a service worker that unconditionally loads the
 * application’s `index.html` for all requests under the given base path.
 * Having a `<base>` tag in `index.html` is sufficient to enable this mode.
 *
 * The `LocationController` will use `popstate` or `hashchange` events to
 * attempt to synchornize changes to the window location to corresponding
 * changes to the `path` and `query` properties, prefering `popstate`.
 *
 * Changes to the `LocationController` `path` and `query` properties will be
 * automatically reflected on the URL and will replace the current entry in the
 * browser history. Use the `mark` method to add a new entry to the history
 * such that users can use the back button to return to the current state.
 *
 * @classdesc Binds the window location to application `path` and `query`
 * properties.
 */
exports.LocationController = Montage.specialize({

    /**
     * The portion of the window location that determines the application view
     * and model parameters, which does not include the prefix `/` or `#!/`.
     * The property is two-way bindable.
     * @type {string}
     */
    path: {
        value: null
    },

    /**
     * The portion of the window location that includes controller parameters,
     * following `?` in the location, after the `/` or the `#!/` shebang
     * depending on the location controller's mode. The property is two-way
     * bindable.  The `query` does not include the initial `?`, and is an empty
     * string if there is no `?` in the location.
     * @type {string}
     */
    query: {
        value: null
    },

    mark: {
        value: function () {
            if (window.history && this._base) {
                window.history.pushState(null, window.title, window.location);
            }
        }
    },

    constructor: {
        value: function LocationController() {
            this.super();
            if (typeof window === "undefined") {
                return;
            }
            window.addEventListener("hashchange", this);
            window.addEventListener("popstate", this);
            this.addPathChangeListener("path", this, "handlePathPropertyChange");

            var document = window.document;
            var bases = document.getElementsByTagName("base");
            if (bases.length) {
                this._base = bases[0].href;
                this._mode = "base";
            } else {
                this._base = window.location.origin + window.location.pathname;
                this._mode = "hash";
            }
            this._computeRemainingPath();
        }
    },

    destructor: {
        value: function () {
            this.super();
            if (typeof window === "undefined") {
                return;
            }
            window.removeEventListener("hashchange", this);
            window.removeEventListener("popstate", this);
        }
    },

    handleEvent: {
        value: function (event) {
            if (event.type === "popstate") {
                event.preventDefault();
                event.stopPropagation();
                this._computeRemainingPath();
                this._popstate = true;
            } else if (event.type === "hashchange" && !this._popstate) {
                event.preventDefault();
                event.stopPropagation();
                this._computeRemainingPath();
            }
        }
    },

    _base: {
        value: null
    },

    _computeRemainingPath: {
        value: function () {
            var base = this._base;
            var match = hashbang.exec(window.location);
            if (match) {
                var path = match[1];
                var queryIndex = path.indexOf("?");
                if (queryIndex >= 0) {
                    this.query = path.slice(queryIndex + 1);
                    this.path = path.slice(0, queryIndex);
                } else {
                    this.query = "";
                    this.path = path;
                }
            } else if (base) {
                var location = "" + window.location;
                if (base.length > location.length) {
                    return;
                }
                if (location.slice(0, base.length) !== base) {
                    return;
                }
                var remaining = location.slice(base.length);
                if (remaining.length && remaining[0] === "/") {
                    remaining = remaining.slice(1);
                }
                if (location.search && location.search[0] === "?") {
                    this.query = location.search.slice(1);
                } else {
                    this.query = "";
                }
                this.path = remaining;
            }
        }
    },

    handlePathPropertyChange: {
        value: function (path) {
            if (path == null) {
                return;
            }
            if (this._mode === "hash") {
                path = "#!/" + path;
            }
            if (window.history) {
                window.history.replaceState(null, "", this._base + path);
            } else {
                window.location.hash = path;
            }
        }
    }

});

