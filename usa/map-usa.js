// initialize the selection box
// initialize the map
var geojson;
var lastClickedLayer;

// Set boundry for state view
//bounds = new L.LatLngBounds(new L.LatLng(41.58, -75.800), new L.LatLng(38.805, -73.263));
var map = L.map('map', {
    // maxBounds: bounds,
    //maxBoundsViscosity: 1.0
}).setView([38.2700, -100.8603], 4);

// Set boundry limits on panning the map
//map.on('drag', function() {
//    map.panInsideBounds(bounds, {
//       animate: false
//  });
//});

// load a tile layer
// Set your own Mapbox public token here. Do not commit a real token.
const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN';
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=' + MAPBOX_TOKEN, {
    minZoom: 4,
    maxZoom: 8,
    attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
        '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox/light-v9',
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// Shows a short message in the page when a data file cannot be loaded.
function showLoadError() {
    var status = document.getElementById("status");
    if (status) {
        status.textContent = "Sorry, the county data failed to load. Please try again later.";
    }
}

// load GeoJSON from an external file (fetched once, then reused for the table and the map)
$.getJSON("usacounties.json", function(data) {
    buildDataTable(data);
    // add GeoJSON layer to the map once the file is loaded
    geojson = L.geoJson(data, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
}).catch(function(err) {
    console.error("Failed to load usacounties.json", err);
    showLoadError();
});
// control that shows state info on hover
var info = L.control();
info.update = function(props) {
    document.getElementById("infoName").innerHTML = '<b>' + props.COUNTY_STATE_NAME + '</b>';
    document.getElementById("infoCovid19Cases").innerHTML = '<b>' + props.COVID19_CASES + '</b>';
    document.getElementById("infoCovid19Deaths").innerHTML = '<b>' + props.COVID19_DEATHS + '</b>';
};

function buildDataTable(data) {
    // COUNTY_STATE_NAME is not unique (e.g. "Fairfax, Virginia" is county 51059 and
    // independent city 51600). In the table only, a name that occurs more than once
    // gets its GEOID appended so each row is distinguishable. The map keys stay GEOID-based.
    var nameCounts = Object.create(null);
    data.features.forEach(function(f) {
        var name = f.properties.COUNTY_STATE_NAME;
        nameCounts[name] = (nameCounts[name] || 0) + 1;
    });

    var table = $('#datatable1').DataTable({
        "data": data.features,
        "deferRender": true,
        "columns": [{
                data: "properties.COUNTY_STATE_NAME",
                render: function(name, type, row) {
                    if (type !== 'display' || nameCounts[name] < 2) {
                        return name;
                    }
                    return name + ' (' + row.properties.GEOID + ')';
                }
            },
            {
                data: "properties.COVID19_CASES"
            },
            {
                data: "properties.COVID19_DEATHS"
            },
        ]
    });
    $('#datatable1 tbody').on('click', 'tr', function() {
        var rowdata = table.row(this).data();
        layerSelect(rowdata.properties.GEOID);
    });
};


function buildLegend() {
    var legendinfo_div = document.getElementById("legendinfo");
    var grades = [0, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000];
    var labels = ['<strong>Confirmed COVID-19 Cases</strong>'];
    var from;
    var to;

    // loop through our density intervals and generate a label with a colored square for each interval
    for (var i = 0; i < grades.length; i++) {
        from = grades[i];
        to = grades[i + 1] - 1;

        legendinfo_div.innerHTML +=
            '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
            grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');

        labels.push(
            '<i style="background:' + getColor(from + 1) + '"></i> ' +
            from + (to ? '&ndash;' + to : '+'));

    }
    legendinfo_div.innerHTML = labels.join('<br>');
}

// Color by cumulative confirmed COVID-19 cases per county. The previous breaks
// (100-1000) were copied from population density, so nearly every county fell
// into the darkest class. The breaks below are the lower bounds of each class,
// set from the distribution in usacounties.json (3,217 counties, median about
// 8,000 cases, 90th percentile about 64,000, max about 3.7 million).
// Class counts at these breaks: <1k 256, 1k-5k 879, 5k-10k 682, 10k-25k 698,
// 25k-50k 299, 50k-100k 186, 100k-250k 147, 250k-500k 48, 500k+ 22.
function getColor(cases) {
    return cases >= 500000 ? '#800026' :
        cases >= 250000 ? '#BD0026' :
        cases >= 100000 ? '#E31A1C' :
        cases >= 50000 ? '#FC4E2A' :
        cases >= 25000 ? '#FD8D3C' :
        cases >= 10000 ? '#FEB24C' :
        cases >= 5000 ? '#FED976' :
        cases >= 1000 ? '#FFEDA0' :
        '#FFFFCC';
}

function style(feature) {
    return {
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7,
        fillColor: getColor(feature.properties.COVID19_CASES)
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
    // Key by GEOID: COUNTY_STATE_NAME is not unique (e.g. Fairfax, Virginia is
    // both county 51059 and independent city 51600).
    layer._leaflet_id = feature.properties.GEOID;
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature,
    });
}

// Fire click event and zoom to polygon  
function layerSelect(geoid) {
    if (lastClickedLayer) {
        geojson.resetStyle(lastClickedLayer);
    }
    var layer = map._layers[geoid];
    if (!layer) {
        return;
    }
    layer.fire('click'); // 'clicks' on county row from the table
    lastClickedLayer = layer;
}


// Setup Custom Controls
buildLegend();

//Setup listener events 
$('#select-box1').change(function() {
    layerSelect(this.value);
});
