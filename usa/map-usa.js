// US county map of final COVID-19 case and death totals (through March 2023).
// Reads usacounties.json, built by import-csvdata-usa.py.
(function() {
    "use strict";

    var esc = Tracker.escapeHtml;
    var fmt = Tracker.formatNumber;
    var num = Tracker.toNumber;

    // Sequential ramp, light to dark. Lower bounds of each class per metric.
    var RAMP = ["#e3eef1", "#c4dde5", "#9fc7d5", "#77aec3", "#5292b0", "#36779c", "#255d87", "#1d436d", "#172c52"];
    var RAMP_INK = ["#14262e", "#14262e", "#14262e", "#14262e", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"];
    var METRICS = {
        cases: {
            key: "COVID19_CASES",
            label: "cases",
            title: "Most cases",
            breaks: [0, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000]
        },
        deaths: {
            key: "COVID19_DEATHS",
            label: "deaths",
            title: "Most deaths",
            breaks: [0, 10, 50, 100, 250, 500, 1000, 2500, 5000]
        }
    };
    var LIST_LIMIT = window.matchMedia && window.matchMedia("(max-width: 960px)").matches ? 15 : 50;

    var state = {
        counties: [],      // {geoid, name, state, cases, deaths, layer}
        byGeoid: {},
        states: {},        // state name -> {cases, deaths, count, bounds}
        metric: "cases",
        stateFilter: "",
        selected: null,    // GEOID
        filter: ""
    };

    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function metric() {
        return METRICS[state.metric];
    }

    function value(c) {
        return state.metric === "cases" ? c.cases : c.deaths;
    }

    // Zero cases means the county reported as part of a larger district.
    function reported(c) {
        return c.cases > 0;
    }

    function classIndex(v) {
        var breaks = metric().breaks;
        for (var i = breaks.length - 1; i >= 0; i--) {
            if (v >= breaks[i]) {
                return i;
            }
        }
        return 0;
    }

    function colorFor(c) {
        return reported(c) ? RAMP[classIndex(value(c))] : (cssVar("--lvl-none") || "#dde3e4");
    }

    function shortNumber(n) {
        if (n >= 1e6) { return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M"; }
        if (n >= 1e3) { return (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace(/\.0$/, "") + "k"; }
        return String(n);
    }

    function rangeLabel(i) {
        var breaks = metric().breaks;
        if (i === breaks.length - 1) {
            return shortNumber(breaks[i]) + "+";
        }
        return (i === 0 ? "Under " : shortNumber(breaks[i]) + " to ") + shortNumber(breaks[i + 1]);
    }

    function deathsPer100(cases, deaths) {
        return cases > 0 ? (deaths / cases * 100).toFixed(2) : "–";
    }

    function inScope(c) {
        return !state.stateFilter || c.state === state.stateFilter;
    }

    // ---------- Summary band ----------

    function renderBand() {
        var bar = document.getElementById("levelbar");
        var key = document.getElementById("levelkey");
        var scoped = state.counties.filter(inScope);
        var counts = RAMP.map(function() { return 0; });
        var missing = 0;
        scoped.forEach(function(c) {
            if (reported(c)) {
                counts[classIndex(value(c))]++;
            } else {
                missing++;
            }
        });
        var total = scoped.length || 1;

        document.getElementById("band-title").textContent =
            (state.stateFilter ? state.stateFilter + " counties" : "Counties") + " by total reported " + metric().label;

        var segs = counts.map(function(n, i) {
            if (!n) {
                return "";
            }
            var share = n / total * 100;
            var label = share >= 7 ? '<span style="--seg-ink:' + RAMP_INK[i] + '">' + rangeLabel(i) + '</span>' : "";
            return '<div class="seg" style="width:' + share.toFixed(2) + '%;background:' + RAMP[i] + ';cursor:default" title="' +
                rangeLabel(i) + ': ' + n + ' counties">' + label + '</div>';
        });
        if (missing) {
            segs.push('<div class="seg" style="width:' + (missing / total * 100).toFixed(2) + '%;background:' +
                cssVar("--lvl-none") + ';cursor:default" title="Not reported: ' + missing + ' counties"></div>');
        }
        bar.innerHTML = segs.join("");

        key.innerHTML = counts.map(function(n, i) {
            return '<li' + (n ? "" : ' class="is-zero"') + '><span class="swatch" style="background:' + RAMP[i] + '"></span>' +
                '<span><strong>' + rangeLabel(i) + '</strong> ' + n + '</span></li>';
        }).join("") + (missing ? '<li><span class="swatch" style="background:' + cssVar("--lvl-none") +
            '"></span><span><strong>Not reported</strong> ' + missing + '</span></li>' : "");
    }

    // ---------- Detail ----------

    function rank(c, pool) {
        var v = value(c);
        var higher = pool.filter(function(o) { return value(o) > v; }).length;
        return higher + 1;
    }

    function renderDetail() {
        var el = document.getElementById("detail");
        var c = state.selected && state.byGeoid[state.selected];

        if (c) {
            var sameState = state.counties.filter(function(o) { return o.state === c.state && reported(o); });
            var nation = state.counties.filter(reported);
            var label = metric().label;
            el.innerHTML = '<h2>' + esc(c.name) + '</h2>' +
                '<p class="sub">' + esc(c.state) + '</p>' +
                (reported(c) ?
                    '<dl class="facts">' +
                    '<div><dt>Cases</dt><dd>' + fmt(c.cases) + '</dd></div>' +
                    '<div><dt>Deaths</dt><dd>' + fmt(c.deaths) + '</dd></div>' +
                    '<div><dt>Deaths per 100 cases</dt><dd>' + deathsPer100(c.cases, c.deaths) + '</dd></div>' +
                    '<div><dt>Rank by ' + label + '</dt><dd>' + rank(c, sameState) + ' of ' + sameState.length + ' in state</dd></div>' +
                    '</dl>' +
                    '<p class="note">' + ordinal(rank(c, nation)) + ' of ' + fmt(nation.length) + ' US counties by ' + label + '.</p>'
                    : '<p class="trend-line">Not reported separately. This county\'s cases were counted with a larger health district.</p>') +
                '<p class="note"><button class="sort" type="button" data-action="clear">Back to ' +
                esc(state.stateFilter || "all states") + '</button></p>';
            return;
        }

        var scoped = state.counties.filter(inScope);
        var cases = scoped.reduce(function(s, o) { return s + o.cases; }, 0);
        var deaths = scoped.reduce(function(s, o) { return s + o.deaths; }, 0);
        el.innerHTML = '<h2>' + esc(state.stateFilter || "United States") + '</h2>' +
            '<p class="sub">' + fmt(scoped.length) + ' counties, final totals through March 2023</p>' +
            '<dl class="facts">' +
            '<div><dt>Cases</dt><dd>' + fmt(cases) + '</dd></div>' +
            '<div><dt>Deaths</dt><dd>' + fmt(deaths) + '</dd></div>' +
            '<div><dt>Deaths per 100 cases</dt><dd>' + deathsPer100(cases, deaths) + '</dd></div>' +
            '</dl>' +
            '<p class="note">Select a county on the map or in the list for its numbers.</p>';
    }

    function ordinal(n) {
        var s = ["th", "st", "nd", "rd"], v = n % 100;
        return fmt(n) + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    // ---------- List ----------

    function renderList() {
        var list = document.getElementById("list");
        var query = state.filter.trim().toLowerCase();
        var rows = state.counties.filter(function(c) {
            return inScope(c) && (!query || c.name.toLowerCase().indexOf(query) !== -1);
        });
        rows.sort(function(a, b) { return value(b) - value(a) || a.name.localeCompare(b.name); });

        var title = query ? "Matching counties" : metric().title + (state.stateFilter ? " in " + state.stateFilter : "");
        document.getElementById("list-title").textContent = title;

        if (!rows.length) {
            list.innerHTML = '<li class="empty">No county' + (state.stateFilter ? " in " + esc(state.stateFilter) : "") +
                ' matches “' + esc(state.filter) + '”.</li>';
            return;
        }

        var max = value(rows[0]) || 1;
        list.innerHTML = rows.slice(0, LIST_LIMIT).map(function(c) {
            var current = c.geoid === state.selected ? ' aria-current="true"' : "";
            var v = value(c);
            return '<li><button type="button" data-geoid="' + esc(c.geoid) + '"' + current + '>' +
                '<span class="name">' + esc(c.name) + (state.stateFilter ? "" : '<small>' + esc(c.state) + '</small>') + '</span>' +
                '<span class="metric-bar" aria-hidden="true"><i style="width:' + (v / max * 100).toFixed(1) + '%"></i></span>' +
                '<span class="value">' + (reported(c) ? fmt(v) : "Not reported") + '</span>' +
                '</button></li>';
        }).join("") + (rows.length > LIST_LIMIT ? '<li class="empty">Showing the top ' + LIST_LIMIT + ' of ' +
            fmt(rows.length) + '. Search or pick a state to narrow the list.</li>' : "");
    }

    // ---------- Map ----------

    var map = L.map("map", {
        preferCanvas: true,
        minZoom: 2,
        zoomSnap: 0.25,
        worldCopyJump: true
    }).setView([38.3, -96.5], 4);
    Tracker.addBasemap(map);
    var lower48 = L.latLngBounds([24.4, -125], [49.4, -66.9]);
    var geojson;

    function featureStyle(feature) {
        var c = state.byGeoid[feature.properties.GEOID];
        var selected = c && c.geoid === state.selected;
        return {
            fillColor: c ? colorFor(c) : cssVar("--lvl-none"),
            fillOpacity: 0.88,
            color: cssVar(selected ? "--ink" : "--surface"),
            weight: selected ? 2.5 : 0.4,
            opacity: 1
        };
    }

    function restyle() {
        if (geojson) {
            geojson.setStyle(featureStyle);
            var c = state.selected && state.byGeoid[state.selected];
            if (c && c.layer) {
                c.layer.bringToFront();
            }
        }
    }

    function updateHash() {
        var parts = [];
        if (state.stateFilter) { parts.push("state=" + encodeURIComponent(state.stateFilter)); }
        if (state.selected) { parts.push("county=" + encodeURIComponent(state.selected)); }
        if (state.metric !== "cases") { parts.push("show=" + state.metric); }
        var hash = parts.length ? "#" + parts.join("&") : "";
        if (location.hash !== hash) {
            history.replaceState(null, "", location.pathname + location.search + hash);
        }
    }

    function renderAll() {
        renderBand();
        renderDetail();
        renderList();
        restyle();
        updateHash();
    }

    function zoomToScope() {
        if (state.stateFilter && state.states[state.stateFilter]) {
            map.flyToBounds(state.states[state.stateFilter].bounds, { padding: [30, 30], duration: 0.6 });
        } else {
            map.flyToBounds(lower48, { padding: [10, 10], duration: 0.6 });
        }
    }

    function select(geoid, options) {
        options = options || {};
        state.selected = geoid && state.byGeoid[geoid] ? geoid : null;
        renderAll();
        if (options.zoom === false) {
            return;
        }
        var c = state.selected && state.byGeoid[state.selected];
        if (c && c.layer) {
            map.flyToBounds(c.layer.getBounds(), { padding: [80, 80], maxZoom: 7, duration: 0.6 });
        } else {
            zoomToScope();
        }
    }

    function setState(name, options) {
        state.stateFilter = name && state.states[name] ? name : "";
        document.getElementById("state").value = state.stateFilter;
        var c = state.selected && state.byGeoid[state.selected];
        if (c && state.stateFilter && c.state !== state.stateFilter) {
            state.selected = null;
        }
        renderAll();
        if (!options || options.zoom !== false) {
            zoomToScope();
        }
    }

    function setMetric(name) {
        state.metric = METRICS[name] ? name : "cases";
        document.querySelectorAll("[data-metric]").forEach(function(b) {
            b.setAttribute("aria-pressed", String(b.getAttribute("data-metric") === state.metric));
        });
        document.getElementById("map").setAttribute("aria-label",
            "Map of US counties colored by total COVID-19 " + metric().label);
        renderAll();
    }

    // ---------- Events ----------

    document.addEventListener("click", function(e) {
        var target = e.target.closest("[data-geoid], [data-action='clear'], [data-metric]");
        if (!target) {
            return;
        }
        if (target.hasAttribute("data-metric")) {
            setMetric(target.getAttribute("data-metric"));
        } else if (target.getAttribute("data-action") === "clear") {
            select(null);
        } else {
            select(target.getAttribute("data-geoid"));
        }
    });

    document.getElementById("state").addEventListener("change", function(e) {
        setState(e.target.value);
    });

    var search = document.getElementById("search");
    search.addEventListener("input", function() {
        state.filter = search.value;
        renderList();
    });
    search.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            var first = document.querySelector("#list [data-geoid]");
            if (first) {
                select(first.getAttribute("data-geoid"));
            }
        }
    });

    if (window.matchMedia) {
        var dark = window.matchMedia("(prefers-color-scheme: dark)");
        if (dark.addEventListener) {
            dark.addEventListener("change", renderAll);
        }
    }

    // ---------- Load ----------

    function readHash() {
        var out = {};
        location.hash.replace(/^#/, "").split("&").forEach(function(pair) {
            var kv = pair.split("=");
            if (kv[0]) {
                out[kv[0]] = decodeURIComponent(kv[1] || "");
            }
        });
        return out;
    }

    fetch("usacounties.json")
        .then(function(response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            data.features.forEach(function(f) {
                var p = f.properties;
                var parts = String(p.COUNTY_STATE_NAME || "").split(", ");
                var stateName = parts.length > 1 ? parts.pop() : "";
                var c = {
                    geoid: String(p.GEOID),
                    name: parts.join(", "),
                    state: stateName,
                    cases: num(p.COVID19_CASES),
                    deaths: num(p.COVID19_DEATHS),
                    layer: null
                };
                state.counties.push(c);
                state.byGeoid[c.geoid] = c;
            });

            // Names that occur twice in one state (e.g. Fairfax county and city, Virginia).
            var seen = {};
            state.counties.forEach(function(c) { var k = c.name + "|" + c.state; seen[k] = (seen[k] || 0) + 1; });
            state.counties.forEach(function(c) {
                if (seen[c.name + "|" + c.state] > 1) {
                    c.name += " (" + c.geoid + ")";
                }
            });

            geojson = L.geoJSON(data, {
                style: featureStyle,
                onEachFeature: function(feature, layer) {
                    var c = state.byGeoid[String(feature.properties.GEOID)];
                    c.layer = layer;
                    var s = state.states[c.state] || (state.states[c.state] = { bounds: L.latLngBounds([]) });
                    if (feature.geometry) {
                        s.bounds.extend(layer.getBounds());
                    }
                    layer.bindTooltip(function() {
                        return '<b>' + esc(c.name) + ', ' + esc(c.state) + '</b>' +
                            (reported(c) ? fmt(value(c)) + " " + metric().label : "Not reported");
                    }, { sticky: true, direction: "top", offset: [0, -8], className: "county-tip" });
                    layer.on({
                        mouseover: function() {
                            layer.setStyle({ weight: 2, color: cssVar("--ink") });
                        },
                        mouseout: restyle,
                        click: function() { select(c.geoid === state.selected ? null : c.geoid); }
                    });
                }
            }).addTo(map);

            var select_ = document.getElementById("state");
            Object.keys(state.states).sort().forEach(function(name) {
                var opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                select_.appendChild(opt);
            });

            var h = readHash();
            if (h.show) { state.metric = METRICS[h.show] ? h.show : "cases"; }
            setMetric(state.metric);
            setState(h.state || "", { zoom: false });
            if (h.county && state.byGeoid[h.county]) {
                select(h.county);
            } else {
                map.fitBounds(state.stateFilter ? state.states[state.stateFilter].bounds : lower48, { padding: [10, 10] });
            }
        })
        .catch(function(err) {
            console.error("Failed to load usacounties.json", err);
            Tracker.showStatus("The county data didn't load. Check that usacounties.json is next to this page, then reload.");
        });
})();
