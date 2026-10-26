// Shared helpers for the NJ and USA maps: base map tiles and small formatters.
//
// Base map: OpenStreetMap's standard tiles by default, which need no API key (light
// use only, see https://operations.osmfoundation.org/policies/tiles/). The page tones
// them down with a CSS filter in assets/tracker.css.
//
// Optional: CARTO's cleaner light/dark tiles, with place names drawn above the counties,
// need a free key from https://carto.com/basemaps/apikey/ (5 million tiles a month for
// non-commercial use). Paste it below to switch to them.
var CARTO_API_KEY = "";

var Tracker = (function() {
    "use strict";

    var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function isDark() {
        return !!(darkQuery && darkQuery.matches);
    }

    function cartoUrl(kind) {
        var style = (isDark() ? "dark_" : "light_") + kind;
        return "https://{s}.basemaps.cartocdn.com/rastertiles/" + style + "/{z}/{x}/{y}{r}.png?key=" +
            encodeURIComponent(CARTO_API_KEY);
    }

    function addOsmBasemap(map) {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            className: "basemap-osm"
        }).addTo(map);
    }

    // CARTO: a label-free base layer under the counties and a labels-only layer above
    // them, so place names stay readable on top of the colored polygons.
    function addCartoBasemap(map) {
        map.createPane("labels");
        map.getPane("labels").style.zIndex = 450;
        map.getPane("labels").style.pointerEvents = "none";

        var attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
            '&copy; <a href="https://carto.com/attributions">CARTO</a>';
        var base = L.tileLayer(cartoUrl("nolabels"), {
            attribution: attribution,
            subdomains: "abcd",
            maxZoom: 19
        }).addTo(map);
        var labels = L.tileLayer(cartoUrl("only_labels"), {
            pane: "labels",
            subdomains: "abcd",
            maxZoom: 19
        }).addTo(map);

        if (darkQuery && darkQuery.addEventListener) {
            darkQuery.addEventListener("change", function() {
                base.setUrl(cartoUrl("nolabels"));
                labels.setUrl(cartoUrl("only_labels"));
            });
        }
    }

    function addBasemap(map) {
        if (CARTO_API_KEY) {
            addCartoBasemap(map);
        } else {
            addOsmBasemap(map);
        }
    }

    function escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function toNumber(value) {
        var n = Number(value);
        return isFinite(n) ? n : 0;
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === "") {
            return "–";
        }
        return Number(value).toLocaleString("en-US");
    }

    function formatDate(iso, options) {
        if (!iso) {
            return "";
        }
        var d = new Date(iso + "T00:00:00");
        return d.toLocaleDateString("en-US", options || { month: "long", day: "numeric", year: "numeric" });
    }

    function showStatus(message) {
        var el = document.getElementById("status");
        if (el) {
            el.textContent = message;
        }
    }

    return {
        addBasemap: addBasemap,
        escapeHtml: escapeHtml,
        toNumber: toNumber,
        formatNumber: formatNumber,
        formatDate: formatDate,
        showStatus: showStatus
    };
})();
