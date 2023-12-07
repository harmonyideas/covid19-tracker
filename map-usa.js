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
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
    minZoom: 4,
    maxZoom: 8,
    attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
        '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox/light-v9',
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// load GeoJSON from an external file
$.ajax({
    url: 'usacounties.json',
    dataType: 'json',
    success: function(data) {
        $.getJSON("usacounties.json", function(data) {
            buildDataTable(data);
            // add GeoJSON layer to the map once the file is loaded
            geojson = L.geoJson(data, {
                style: style,
                onEachFeature: onEachFeature
            }).addTo(map);
        });
    },
    error: function(err) {
        console.log("AJAX error in request: " + JSON.stringify(err, null, 2));
    }
});
// control that shows state info on hover
var info = L.control();
info.update = function(props) {
    document.getElementById("infoName").innerHTML = '<b>' + props.COUNTY_STATE_NAME + '</b>';
    document.getElementById("infoCovid19Cases").innerHTML = '<b>' + props.COVID19_CASES + '</b>';
    document.getElementById("infoCovid19Deaths").innerHTML = '<b>' + props.COVID19_DEATHS + '</b>';
};

function buildDataTable(data) {
    var table = $('#datatable1').DataTable({
        "data": data.features,
        "deferRender": true,
        "columns": [{
                data: "properties.COUNTY_STATE_NAME"
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
        layerSelect(rowdata.properties.COUNTY_STATE_NAME);
    });
};


function buildLegend() {
    var legendinfo_div = document.getElementById("legendinfo");
    var grades = [0, 50, 100, 200, 300, 400, 500];
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

// get color depending on population density value
function getColor(d) {
    return d > 1000 ? '#800026' :
        d > 500 ? '#BD0026' :
        d > 400 ? '#E31A1C' :
        d > 300 ? '#FC4E2A' :
        d > 200 ? '#FD8D3C' :
        d > 100 ? '#FEB24C' :
        d > 0 ? '#FED976' :
        '#FFEDA0';
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
    layer._leaflet_id = feature.properties.COUNTY_STATE_NAME;
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature,
    });
}

// Fire click event and zoom to polygon  
function layerSelect(a) {
    if (lastClickedLayer) {
        geojson.resetStyle(lastClickedLayer);
    }
    var layer = map._layers[a];
    layer.fire('click'); // 'clicks' on state name from search
    lastClickedLayer = layer;
}


// Setup Custom Controls
//buildLegend();

//Setup listener events 
$('#select-box1').change(function() {
    layerSelect(this.value);
});
