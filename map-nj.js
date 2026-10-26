// New Jersey COVID-19 wastewater map.
// Reads njcounties.json, which import-wastewater-nj.py refreshes weekly from CDC data.
(function() {
    "use strict";

    var LEVELS = ["Very Low", "Low", "Moderate", "High", "Very High"];
    var LEVEL_LABELS = ["Very low", "Low", "Moderate", "High", "Very high"];
    // Keep in sync with --lvl-0 ... --lvl-4 in assets/tracker.css.
    var LEVEL_COLORS = ["#cbe6dd", "#86c2ae", "#edb841", "#d9662b", "#962140"];
    var LEVEL_INK = ["#14262e", "#14262e", "#14262e", "#14262e", "#ffffff"];

    var esc = Tracker.escapeHtml;
    var fmt = Tracker.formatNumber;

    var state = {
        counties: [],          // feature properties, one per county
        weeks: [],             // ISO week-end dates, oldest first
        layers: {},            // county name -> Leaflet layer
        selected: null,        // county name or null for statewide
        sortByName: false,
        imported: true,        // false until import-wastewater-nj.py has run
        filter: ""
    };

    // ---------- Level helpers ----------

    function levelIndex(level) {
        return LEVELS.indexOf(level);
    }

    function levelLabel(level) {
        var i = levelIndex(level);
        return i < 0 ? "No data" : LEVEL_LABELS[i];
    }

    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function noDataColor() {
        return cssVar("--lvl-none") || "#dde3e4";
    }

    function levelColor(level) {
        var i = levelIndex(level);
        return i < 0 ? noDataColor() : LEVEL_COLORS[i];
    }

    function levelInk(level) {
        var i = levelIndex(level);
        return i < 0 ? "" : LEVEL_INK[i];
    }

    function colorVars(prefix, level) {
        var i = levelIndex(level);
        if (i < 0) {
            return "";
        }
        return "--" + prefix + "-bg:" + LEVEL_COLORS[i] + ";--" + prefix + "-ink:" + LEVEL_INK[i] + ";";
    }

    function countyHistory(props) {
        return Array.isArray(props.WW_HISTORY) ? props.WW_HISTORY : [];
    }

    // Population-weighted statewide level for each history week (or this week only,
    // if the data file has no history yet).
    function statewideHistory() {
        var n = state.weeks.length || 1;
        var out = [];
        for (var w = 0; w < n; w++) {
            var weight = 0, levelSum = 0, wvalSum = 0, wvalWeight = 0;
            state.counties.forEach(function(p) {
                var entry = state.weeks.length ? countyHistory(p)[w] : (levelIndex(p.WW_LEVEL) >= 0 ? { level: p.WW_LEVEL, wval: p.WW_WVAL } : null);
                if (!entry || levelIndex(entry.level) < 0) {
                    return;
                }
                var pop = Tracker.toNumber(p.POPULATION) || 1;
                weight += pop;
                levelSum += pop * levelIndex(entry.level);
                if (entry.wval !== null && entry.wval !== undefined) {
                    wvalSum += pop * entry.wval;
                    wvalWeight += pop;
                }
            });
            out.push(weight ? {
                level: LEVELS[Math.round(levelSum / weight)],
                wval: wvalWeight ? Math.round(wvalSum / wvalWeight * 100) / 100 : null
            } : null);
        }
        return out;
    }

    function trendSentence(now, before) {
        if (levelIndex(now) < 0) {
            return "";
        }
        if (!before || levelIndex(before.level) < 0) {
            return "No reading the week before.";
        }
        var diff = levelIndex(now) - levelIndex(before.level);
        if (diff === 0) {
            return "Same level as the week before.";
        }
        return (diff > 0 ? "Up from " : "Down from ") + levelLabel(before.level).toLowerCase() + " the week before.";
    }

    // ---------- Rendering: summary band ----------

    function renderBand() {
        var bar = document.getElementById("levelbar");
        var key = document.getElementById("levelkey");
        var total = state.counties.reduce(function(sum, p) { return sum + Tracker.toNumber(p.POPULATION); }, 0) || 1;

        var ordered = state.counties.slice().sort(function(a, b) {
            return levelIndex(b.WW_LEVEL) - levelIndex(a.WW_LEVEL) ||
                Tracker.toNumber(b.POPULATION) - Tracker.toNumber(a.POPULATION);
        });
        // No-data counties go last.
        ordered = ordered.filter(function(p) { return levelIndex(p.WW_LEVEL) >= 0; })
            .concat(ordered.filter(function(p) { return levelIndex(p.WW_LEVEL) < 0; }));

        bar.innerHTML = ordered.map(function(p) {
            var share = Tracker.toNumber(p.POPULATION) / total * 100;
            var label = share >= 6.5 ? '<span style="--seg-ink:' + (levelInk(p.WW_LEVEL) || "var(--ink)") + '">' + esc(p.NAME) + '</span>' : "";
            return '<button class="seg" type="button" tabindex="-1" data-county="' + esc(p.NAME) + '"' +
                ' title="' + esc(p.NAME) + ': ' + levelLabel(p.WW_LEVEL) + '"' +
                ' style="width:' + share.toFixed(2) + '%;background:' + levelColor(p.WW_LEVEL) + '">' + label + '</button>';
        }).join("");

        var groups = LEVELS.slice().reverse().concat([null]).map(function(level) {
            var members = state.counties.filter(function(p) {
                return level === null ? levelIndex(p.WW_LEVEL) < 0 : p.WW_LEVEL === level;
            });
            var pop = members.reduce(function(sum, p) { return sum + Tracker.toNumber(p.POPULATION); }, 0);
            return { level: level, count: members.length, share: Math.round(pop / total * 100) };
        });

        key.innerHTML = groups.map(function(g) {
            var name = g.level === null ? "No data" : levelLabel(g.level);
            if (!g.count) {
                return '<li class="is-zero"><span class="swatch" style="background:' + levelColor(g.level) + '"></span>' +
                    '<span><strong>' + name + '</strong> none</span></li>';
            }
            var counties = g.count === 1 ? "1 county" : g.count + " counties";
            return '<li><span class="swatch" style="background:' + levelColor(g.level) + '"></span>' +
                '<span><strong>' + name + '</strong> ' + g.share + '% of residents, ' + counties + '</span></li>';
        }).join("");
    }

    // ---------- Rendering: history chart ----------

    function historyChart(entries, title) {
        if (!entries.length || !state.weeks.length) {
            return "";
        }
        var width = 352, height = 132, top = 14, bottom = 22;
        var plot = height - top - bottom;
        var max = entries.reduce(function(m, e) { return e && e.wval > m ? e.wval : m; }, 0);
        max = Math.max(10, Math.ceil(max / 5) * 5);
        var slot = width / entries.length;
        var barW = Math.min(30, slot - 8);

        var bars = entries.map(function(e, i) {
            var x = i * slot + (slot - barW) / 2;
            var week = Tracker.formatDate(state.weeks[i], { month: "short", day: "numeric" });
            if (!e || levelIndex(e.level) < 0) {
                return '<rect x="' + x.toFixed(1) + '" y="' + (top + plot - 3) + '" width="' + barW.toFixed(1) +
                    '" height="3" fill="' + noDataColor() + '"><title>Week ending ' + week + ': no data</title></rect>';
            }
            var value = e.wval === null || e.wval === undefined ? max * (levelIndex(e.level) + 1) / 5 : e.wval;
            var h = Math.max(3, value / max * plot);
            return '<rect x="' + x.toFixed(1) + '" y="' + (top + plot - h).toFixed(1) + '" width="' + barW.toFixed(1) +
                '" height="' + h.toFixed(1) + '" rx="2" fill="' + levelColor(e.level) + '">' +
                '<title>Week ending ' + week + ': ' + levelLabel(e.level) +
                (e.wval !== null && e.wval !== undefined ? " (" + e.wval + ")" : "") + '</title></rect>';
        }).join("");

        var first = Tracker.formatDate(state.weeks[0], { month: "short", day: "numeric" });
        var last = Tracker.formatDate(state.weeks[state.weeks.length - 1], { month: "short", day: "numeric" });

        return '<div class="history"><p class="history-title">' + esc(title) + '</p>' +
            '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(title) + '">' +
            '<line class="gridline" x1="0" x2="' + width + '" y1="' + (top + plot) + '" y2="' + (top + plot) + '"></line>' +
            '<line class="gridline" x1="0" x2="' + width + '" y1="' + top + '" y2="' + top + '" stroke-dasharray="3 4"></line>' +
            '<text class="axis" x="' + width + '" y="' + (top - 4) + '" text-anchor="end">' + max + '</text>' +
            bars +
            '<text class="axis" x="' + (slot / 2) + '" y="' + (height - 4) + '" text-anchor="middle">' + first + '</text>' +
            '<text class="axis" x="' + (width - slot / 2) + '" y="' + (height - 4) + '" text-anchor="middle">' + last + '</text>' +
            '</svg></div>';
    }

    function miniStrip(props) {
        var entries = countyHistory(props);
        if (!entries.length) {
            return "";
        }
        var cell = 8, gap = 2;
        var w = entries.length * (cell + gap) - gap;
        var rects = entries.map(function(e, i) {
            var color = e && levelIndex(e.level) >= 0 ? levelColor(e.level) : noDataColor();
            return '<rect x="' + i * (cell + gap) + '" y="0" width="' + cell + '" height="16" rx="1.5" fill="' + color + '"></rect>';
        }).join("");
        return '<svg class="spark" width="' + w + '" height="16" viewBox="0 0 ' + w + ' 16" aria-hidden="true">' + rects + '</svg>';
    }

    // ---------- Rendering: detail panel ----------

    function badge(level) {
        return '<div class="level-badge" style="' + colorVars("badge", level) + '">' + levelLabel(level) + '</div>';
    }

    function renderStatewide() {
        var hist = statewideHistory();
        var now = hist[hist.length - 1];
        var before = hist.length > 1 ? hist[hist.length - 2] : null;
        var reporting = state.counties.filter(function(p) { return levelIndex(p.WW_LEVEL) >= 0; });
        var topLevel = reporting.length ? Math.max.apply(null, reporting.map(function(p) { return levelIndex(p.WW_LEVEL); })) : -1;
        var highest = reporting.filter(function(p) { return levelIndex(p.WW_LEVEL) === topLevel; })
            .map(function(p) { return p.NAME; }).sort();
        var highestText = !highest.length ? "–" :
            highest.length <= 2 ? highest.join(" and ") :
            levelLabel(LEVELS[topLevel]) + " in " + highest.length + " counties";

        return '<h2>New Jersey</h2>' +
            '<p class="sub">Statewide, weighted by county population</p>' +
            badge(now && now.level) +
            '<p class="trend-line">' + esc(trendSentence(now && now.level, before)) + '</p>' +
            '<dl class="facts">' +
            '<div><dt>Counties reporting</dt><dd>' + reporting.length + ' of ' + state.counties.length + '</dd></div>' +
            '<div><dt>Highest this week</dt><dd>' + esc(highestText) + '</dd></div>' +
            '</dl>' +
            historyChart(hist, "Statewide level, last " + hist.length + " weeks") +
            '<p class="note">Select a county on the map or in the list for its own trend.</p>';
    }

    function renderCounty(p) {
        var hist = countyHistory(p);
        var before = hist.length > 1 ? hist[hist.length - 2] : null;
        var hasData = levelIndex(p.WW_LEVEL) >= 0;
        var sites = Tracker.toNumber(p.WW_SITES);

        return '<h2>' + esc(p.NAME) + ' County</h2>' +
            '<p class="sub">Population ' + fmt(p.POPULATION) + '</p>' +
            badge(p.WW_LEVEL) +
            '<p class="trend-line">' + (hasData ? esc(trendSentence(p.WW_LEVEL, before))
                : state.imported ? "No treatment plant in this county reports to CDC's wastewater network."
                : "Wastewater levels haven't been loaded yet.") + '</p>' +
            '<dl class="facts">' +
            '<div><dt>Treatment plants</dt><dd>' + (sites || "None") + '</dd></div>' +
            '<div><dt>CDC activity value</dt><dd>' + (p.WW_WVAL === null || p.WW_WVAL === undefined ? "–" : p.WW_WVAL) + '</dd></div>' +
            '<div><dt>Cases, 2020 to 2023</dt><dd>' + fmt(p.COVID19_CASES) + '</dd></div>' +
            '<div><dt>Deaths, 2020 to 2023</dt><dd>' + fmt(p.COVID19_DEATHS) + '</dd></div>' +
            '</dl>' +
            (hasData || hist.some(Boolean) ? historyChart(hist, "Level, last " + hist.length + " weeks") : "") +
            '<p class="note"><button class="sort" type="button" data-action="clear">Back to all of New Jersey</button></p>';
    }

    function renderDetail() {
        var el = document.getElementById("detail");
        var p = state.selected && findCounty(state.selected);
        el.innerHTML = p ? renderCounty(p) : renderStatewide();
    }

    // ---------- Rendering: list ----------

    function renderList() {
        var list = document.getElementById("list");
        var query = state.filter.trim().toLowerCase();
        var rows = state.counties.filter(function(p) {
            return !query || p.NAME.toLowerCase().indexOf(query) !== -1;
        });
        rows.sort(function(a, b) {
            if (!state.sortByName) {
                var diff = levelIndex(b.WW_LEVEL) - levelIndex(a.WW_LEVEL);
                if (diff) {
                    return diff;
                }
            }
            return a.NAME.localeCompare(b.NAME);
        });

        if (!rows.length) {
            list.innerHTML = '<li class="empty">No New Jersey county matches “' + esc(state.filter) + '”.</li>';
            return;
        }

        list.innerHTML = rows.map(function(p) {
            var current = p.NAME === state.selected ? ' aria-current="true"' : "";
            return '<li><button type="button" data-county="' + esc(p.NAME) + '"' + current + '>' +
                '<span class="name">' + esc(p.NAME) + '</span>' +
                miniStrip(p) +
                '<span class="chip" style="' + colorVars("chip", p.WW_LEVEL) + '">' + levelLabel(p.WW_LEVEL) + '</span>' +
                '</button></li>';
        }).join("");
    }

    // ---------- Map ----------

    var njBounds = L.latLngBounds([38.6, -76.2], [41.8, -72.9]);
    var map = L.map("map", {
        maxBounds: njBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 7,
        zoomSnap: 0.25
    }).setView([40.15, -74.6], 8);
    Tracker.addBasemap(map);

    var geojson;

    function featureStyle(feature) {
        var selected = feature.properties.NAME === state.selected;
        return {
            fillColor: levelColor(feature.properties.WW_LEVEL),
            fillOpacity: 0.85,
            color: cssVar(selected ? "--ink" : "--surface"),
            weight: selected ? 3 : 1,
            opacity: 1
        };
    }

    function restyle() {
        if (geojson) {
            geojson.setStyle(featureStyle);
            var layer = state.selected && state.layers[state.selected];
            if (layer) {
                layer.bringToFront();
            }
        }
    }

    function findCounty(name) {
        for (var i = 0; i < state.counties.length; i++) {
            if (state.counties[i].NAME === name) {
                return state.counties[i];
            }
        }
        return null;
    }

    function select(name, options) {
        options = options || {};
        state.selected = name && findCounty(name) ? name : null;
        renderDetail();
        renderList();
        restyle();

        var hash = state.selected ? "#county=" + encodeURIComponent(state.selected) : "";
        if (location.hash !== hash) {
            history.replaceState(null, "", location.pathname + location.search + hash);
        }

        if (options.zoom !== false) {
            var layer = state.selected && state.layers[state.selected];
            if (layer) {
                map.flyToBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 9, duration: 0.6 });
            } else if (geojson) {
                map.flyToBounds(geojson.getBounds(), { padding: [20, 20], duration: 0.6 });
            }
        }
    }

    function onEachFeature(feature, layer) {
        var p = feature.properties;
        state.layers[p.NAME] = layer;
        layer.bindTooltip('<b>' + esc(p.NAME) + '</b>' + levelLabel(p.WW_LEVEL), {
            sticky: true,
            direction: "top",
            offset: [0, -8],
            className: "county-tip"
        });
        layer.on({
            mouseover: function() {
                layer.setStyle({ weight: 3, color: cssVar("--ink") });
                layer.bringToFront();
            },
            mouseout: function() { restyle(); },
            click: function() { select(p.NAME === state.selected ? null : p.NAME); }
        });
    }

    // ---------- Events ----------

    document.addEventListener("click", function(e) {
        var target = e.target.closest("[data-county], [data-action='clear']");
        if (!target) {
            return;
        }
        if (target.getAttribute("data-action") === "clear") {
            select(null);
        } else {
            select(target.getAttribute("data-county"));
        }
    });

    var search = document.getElementById("search");
    search.addEventListener("input", function() {
        state.filter = search.value;
        renderList();
    });
    search.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            var first = document.querySelector("#list [data-county]");
            if (first) {
                select(first.getAttribute("data-county"));
            }
        }
    });

    var sortButton = document.getElementById("sort");
    sortButton.addEventListener("click", function() {
        state.sortByName = !state.sortByName;
        sortButton.textContent = state.sortByName ? "Sort by level" : "Sort by name";
        renderList();
    });

    if (window.matchMedia) {
        var dark = window.matchMedia("(prefers-color-scheme: dark)");
        if (dark.addEventListener) {
            dark.addEventListener("change", function() {
                renderBand();
                renderDetail();
                renderList();
                restyle();
            });
        }
    }

    // ---------- Load ----------

    fetch("njcounties.json", { cache: "no-cache" })
        .then(function(response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            // The "Unassigned" feature (GEOID "0") is not a county and has no polygon.
            var features = data.features.filter(function(f) { return f.properties.GEOID !== "0"; });
            state.counties = features.map(function(f) { return f.properties; });
            state.weeks = Array.isArray(data.ww_weeks) ? data.ww_weeks : [];

            state.imported = !!data.ww_week_end;
            if (!state.imported) {
                Tracker.showStatus("Wastewater levels haven't been loaded yet. Run import-wastewater-nj.py to fetch this week's CDC data.");
            }
            if (data.ww_week_end) {
                document.getElementById("lede").textContent = "CDC viral activity levels for each county, week ending " +
                    Tracker.formatDate(data.ww_week_end) + ". New data every Friday.";
            }

            geojson = L.geoJSON({ type: "FeatureCollection", features: features }, {
                style: featureStyle,
                onEachFeature: onEachFeature
            }).addTo(map);
            map.fitBounds(geojson.getBounds(), { padding: [20, 20] });

            renderBand();
            var fromHash = decodeURIComponent((location.hash.match(/county=([^&]+)/) || [])[1] || "");
            select(fromHash || null, { zoom: !!fromHash });
        })
        .catch(function(err) {
            console.error("Failed to load njcounties.json", err);
            Tracker.showStatus("The county data didn't load. Check that njcounties.json is next to this page, then reload.");
            renderDetail();
        });
})();
