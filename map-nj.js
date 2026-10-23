// initialize the selection box
// initialize the map
var geojson;
var lastClickedLayer;
var njcounties = ["Atlantic", "Bergen", "Burlington", "Camden", "Cape May", "Cumberland", "Essex",
    "Gloucester", "Hudson", "Hunterdon", "Mercer", "Middlesex", "Monmouth",
    "Morris", "Ocean", "Passaic", "Salem", "Somerset", "Sussex", "Union",
    "Warren"
];

// CDC wastewater viral activity levels, lowest to highest, with map colors.
var WW_LEVELS = ["Very Low", "Low", "Moderate", "High", "Very High"];
var WW_COLORS = {
    "Very Low": "#FFEDA0",
    "Low": "#FED976",
    "Moderate": "#FD8D3C",
    "High": "#E31A1C",
    "Very High": "#800026"
};
var NO_DATA_COLOR = "#BDBDBD";
var TREND_ARROWS = { "Up": "&#9650; up", "Down": "&#9660; down", "Same": "&#9654; no change" };

// Set boundry for NorthWest and SouthEast NJ map coordinates
var bounds = new L.LatLngBounds(new L.LatLng(41.58, -75.800), new L.LatLng(38.805, -73.263));
var map = L.map('map', {
    maxBounds: bounds,
    maxBoundsViscosity: 1.0
}).setView([40.44, -74.59], 8);

// Limit panning to the boundry set
map.on('drag', function() {
    map.panInsideBounds(bounds, {
        animate: false
    });
});

// load a tile layer. OpenStreetMap serves 256px tiles, so Leaflet's defaults
// apply (the old 512px/zoomOffset settings were for Mapbox and blurred the map).
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 7,
    maxZoom: 9,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | ' +
        'Wastewater data: <a href="https://www.cdc.gov/nwss/">CDC NWSS</a>'
}).addTo(map);


// Shows a short message in the page when a data file cannot be loaded.
function showLoadError() {
    var status = document.getElementById("status");
    if (status) {
        status.textContent = "Sorry, the county data failed to load. Please try again later.";
    }
}

// Shows which CDC reporting week the map is for.
function showWeek(data) {
    var week = document.getElementById("weekinfo");
    if (week && data.ww_week_end) {
        var d = new Date(data.ww_week_end + "T00:00:00");
        week.textContent = "Week ending " + d.toLocaleDateString("en-US", {
            month: "long", day: "numeric", year: "numeric"
        });
    }
}

// load GeoJSON from an external file
$.getJSON("njcounties.json", function(data) {
    // add GeoJSON layer to the map once the file is loaded
    geojson = L.geoJson(data, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
    buildDataTable(data);
    showWeek(data);
}).catch(showLoadError);


function levelText(props) {
    return props.WW_LEVEL || "No data";
}

function trendText(props) {
    return TREND_ARROWS[props.WW_TREND] || "&ndash;";
}

function formatNumber(n) {
    return (n === null || n === undefined) ? "&ndash;" : Number(n).toLocaleString("en-US");
}

// control that shows state info on hover
var info = L.control();

info.update = function(props) {
    document.getElementById("infoName").innerHTML = '<b>' + props.NAME + '</b>';
    document.getElementById("infoPopulation").innerHTML = '<b>' + formatNumber(props.POPULATION) + '</b>';
    document.getElementById("infoWwLevel").innerHTML =
        '<i class="swatch" style="background:' + getColor(props.WW_LEVEL) + '"></i><b>' + levelText(props) + '</b>';
    document.getElementById("infoWwTrend").innerHTML = '<b>' + trendText(props) + '</b>';
    document.getElementById("infoWwSites").innerHTML = '<b>' + formatNumber(props.WW_SITES) + '</b>';
    document.getElementById("infoCovid19Cases").innerHTML = '<b>' + formatNumber(props.COVID19_CASES) + '</b>';
    document.getElementById("infoCovid19Deaths").innerHTML = '<b>' + formatNumber(props.COVID19_DEATHS) + '</b>';
};

// Initialize JSON datatable
const buildDataTable = (data) => {
  // Skip the "Unassigned" feature (GEOID "0"): it is not a county and has an empty polygon.
  const rows = data.features.filter(function(f) {
    return f.properties.GEOID !== "0";
  });
  $('#datatable1').DataTable({
    "data": rows,
    "order": [[1, "desc"]],
    "columns": [
      {
        "data": "properties.NAME"
      },
      {
        // Sort by level (High above Low), display the CDC label.
        "data": "properties.WW_LEVEL",
        "render": function(level, type) {
          if (type === "sort" || type === "type") {
            return WW_LEVELS.indexOf(level);
          }
          return level || "No data";
        }
      },
      {
        "data": "properties.WW_TREND",
        "render": function(t, type) {
          return type === "display" ? (TREND_ARROWS[t] || "&ndash;") : (t || "");
        }
      },
      {
        "data": "properties.WW_SITES",
        "defaultContent": "0"
      },
      {
        "data": "properties.COVID19_CASES"
      },
      {
        "data": "properties.COVID19_DEATHS"
      },
    ]
  });
};

// Initialize the drop down
function buildSelect() {
    var options_str = "";
    for (var i = 0, len = njcounties.length; i < len; i++) {
        options_str += '<option value="' + njcounties[i] + '">' + njcounties[i] + '</option>';
    }
    var options_div = document.getElementById("selectlayer");
    options_div.innerHTML += '<select id="select-box1" class="select-box"><option>New Jersey</option>' +
        options_str + '</select>';
    L.DomEvent.disableClickPropagation(options_div); // Enable dropdown to work with mobile
    options_div.firstChild.onmousedown = options_div.firstChild.ondblclick = L.DomEvent.stopPropagation;
}

// Initialize the map legend
function buildLegend() {
    var labels = ['<strong>COVID-19 wastewater level</strong>'];
    for (var i = WW_LEVELS.length - 1; i >= 0; i--) {
        labels.push('<i style="background:' + WW_COLORS[WW_LEVELS[i]] + '"></i> ' + WW_LEVELS[i]);
    }
    labels.push('<i style="background:' + NO_DATA_COLOR + '"></i> No data');
    document.getElementById("legendinfo").innerHTML = labels.join('<br>');
}

// Assign map color to a county from its CDC wastewater level.
function getColor(level) {
    return WW_COLORS[level] || NO_DATA_COLOR;
}


// Style layers
function style(feature) {
    return {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7,
        fillColor: getColor(feature.properties.WW_LEVEL)
    };
}

function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 3,
        color: '#404040',
        dashArray: '',
        fillOpacity: 0.7
    });
    info.update(layer.feature.properties);

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

function resetHighlight(e) {
    geojson.resetStyle(e.target);
    //  info.update(layer.feature.properties);
}

function zoomToFeature(e) {
    highlightFeature(e);
    map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
    layer._leaflet_id = feature.properties.NAME;
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature,
    });
}

function layerSelect(layerId) {
    // Zooms to the polygon of the selected layer.

    if (lastClickedLayer) {
        geojson.resetStyle(lastClickedLayer);
        lastClickedLayer = null;
    }
    const layer = map._layers[layerId];
    if (!layer) {
        // "New Jersey" is not a county polygon: go back to the full-state view.
        map.setView([40.44, -74.59], 8);
        return;
    }
    layer.fire('click');
    lastClickedLayer = layer;
}

// Setup Custom Controls
buildSelect();
buildLegend();

//Setup listener events
$('#select-box1').change(function() {
    layerSelect(this.value);
});
