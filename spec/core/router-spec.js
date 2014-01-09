
var Router = require("../../core/router").Router;

var router = new Router("/", {
    "photos/+photoIds&": "photos",
    "photos.:format": "photo-format",
    "photo/+photoId": "photo",
    "photo/+photoId/comments/+commentId": "photo-comment",
    "notes/:noteId?": "notes",
    "notes/:noteId?/detail": "notes-detail",
    "a/:/b/:": "ab",
    "::": "colon"
});

describe("parse", function () {

    it("/photo/10/comments/20 over /photos/+photoId/comments/+commentId", function () {
        var state = router.parse("/photo/10/comments/20");
        expect(state).toEqual({
            destination: "photo-comment",
            parameters: {
                photoId: 10,
                commentId: 20
            },
            path: undefined
        });
    });

    it("/photos.html over /photos.:format", function () {
        var state = router.parse("/photos.html");
        expect(state).toEqual({
            destination: "photo-format",
            parameters: {
                format: "html"
            },
            path: undefined
        });
    });

    it("plural optional", function () {
        var state = router.parse("/photos");
        expect(state.parameters.photoIds).toEqual([]);
    });

    it("plural optional with slash", function () {
        var state = router.parse("/photos/");
        expect(state.parameters.photoIds).toEqual([]);
    });

    it("plural one", function () {
        var state = router.parse("/photos/10");
        expect(state.parameters.photoIds).toEqual([10]);
    });

    it("plural two", function () {
        var state = router.parse("/photos/10&20");
        expect(state.parameters.photoIds).toEqual([10, 20]);
    });

    it("plural three", function () {
        var state = router.parse("/photos/10&20&30");
        expect(state.parameters.photoIds).toEqual([10, 20, 30]);
        expect(state).toEqual({
            destination: "photos",
            parameters: {
                photoIds: [10, 20, 30]
            },
            path: undefined
        });
    });

    it("escape colon", function () {
        var state = router.parse("/:");
        expect(state).toEqual({
            destination: "colon",
            parameters: {},
            path: undefined
        });
    });

});

describe("stringify", function () {

    it("/photo/11/comments/0", function () {
        var path = router.stringify({
            destination: "photo-comment",
            parameters: {
                photoId: 11,
                commentId: 0
            }
        });
        expect(path).toBe("/photo/11/comments/0");
    });

    it("/notes", function () {
        var path = router.stringify({
            destination: "notes",
            parameters: {}
        });
        expect(path).toBe("/notes");
    });

    it("/notes/0", function () {
        var path = router.stringify({
            destination: "notes",
            parameters: {
                noteId: 0
            }
        });
        expect(path).toBe("/notes/0");
    });

    it("/notes/detail", function () {
        var path = router.stringify({
            destination: "notes-detail",
            parameters: {}
        });
        expect(path).toBe("/notes/detail");
    });

    it("/notes/0/detail", function () {
        var path = router.stringify({
            destination: "notes-detail",
            parameters: {
                noteId: 0
            }
        });
        expect(path).toBe("/notes/0/detail");
    });

});

var Scope = require("frb/scope");

describe("observeStringify", function () {
    it("reacts to changes in parameters for the destination", function () {

        var state = {
            destination: "notes-detail",
            parameters: {
                noteId: null
            }
        };
        var path;

        var cancel = router.observeStringify(function (_path) {
            path = _path;
        }, state, new Scope());

        expect(path).toBe("/notes/detail");

        state.parameters.noteId = 10;
        expect(path).toBe("/notes/10/detail");

        state.destination = "nowhere";
        expect(path).toBe(undefined);

    });

    it("reacts to changes in parameters for the destination", function () {

        var state = {
            destination: "photos",
            parameters: {
                photoIds: []
            }
        };
        var path;

        var cancel = router.observeStringify(function (_path) {
            path = _path;
        }, state, new Scope());
        expect(path).toBe("/photos/");

        state.parameters.photoIds.push(10);
        expect(path).toBe("/photos/10");

        state.parameters.photoIds.push(20);
        expect(path).toBe("/photos/10&20");

        state.parameters.photoIds.push(30);
        expect(path).toBe("/photos/10&20&30");

        state.parameters.photoIds = null;
        expect(path).toBe("/photos/");
    });
});

