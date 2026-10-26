// Shared helpers for the NJ and USA maps: base map tiles and small formatters.
// No API key is needed: tiles come from CARTO's free basemaps (OpenStreetMap data).

var Tracker = (function() {
    "use strict";

    var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function isDark() {
        return !!(darkQuery && darkQuery.matches);
    }

    function tileUrl(kind) {
        var style = (isDark() ? "dark_" : "light_") + kind;
        return "https://{s}.basemaps.cartocdn.com/" + style + "/{z}/{x}/{y}{r}.png";
    }

    // Adds a label-free base layer under the counties and a labels-only layer above
    // them, so place names stay readable on top of the colored polygons.
    function addBasemap(map) {
        map.createPane("labels");
        map.getPane("labels").style.zIndex = 450;
        map.getPane("labels").style.pointerEvents = "none";

        var attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
            '&copy; <a href="https://carto.com/attributions">CARTO</a>';
        var base = L.tileLayer(tileUrl("nolabels"), {
            attribution: attribution,
            subdomains: "abcd",
            maxZoom: 19
        }).addTo(map);
        var labels = L.tileLayer(tileUrl("only_labels"), {
            pane: "labels",
            subdomains: "abcd",
            maxZoom: 19
        }).addTo(map);

        if (darkQuery && darkQuery.addEventListener) {
            darkQuery.addEventListener("change", function() {
                base.setUrl(tileUrl("nolabels"));
                labels.setUrl(tileUrl("only_labels"));
            });
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
