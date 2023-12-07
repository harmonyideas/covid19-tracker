// initialize the selection box
// initialize the map
var geojson;
var lastClickedLayer;
var njcounties = ["Atlantic", "Bergen", "Burlington", "Camden", "Cape May", "Cumberland", "Essex",
    "Gloucester", "Hudson", "Hunterdon", "Mercer", "Middlesex", "Monmouth",
    "Morris", "Ocean", "Passaic", "Salem", "Somerset", "Sussex", "Union",
    "Warren"
];

// Set boundry for NorthWest and SouthEast NJ map coordinates
bounds = new L.LatLngBounds(new L.LatLng(41.58, -75.800), new L.LatLng(38.805, -73.263));
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

// load a tile layer
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 7,
    maxZoom: 9,
    attribution:'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    id: 'mapbox/light-v9',
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);


// load GeoJSON from an external file
$.getJSON("njcounties.json", function(data) {
    buildDataTable(data);
    // add GeoJSON layer to the map once the file is loaded
    geojson = L.geoJson(data, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
});


// control that shows state info on hover
var info = L.control();

info.update = function(props) {
    document.getElementById("infoName").innerHTML = '<b>' + props.NAME + '</b>';
    document.getElementById("infoPopulation").innerHTML = '<b>' + props.POPULATION + '</b>';
    document.getElementById("infoPopDensity").innerHTML = '<b>' + props.POP_DENSITY + '</b>';
    document.getElementById("infoCovid19Cases").innerHTML = '<b>' + props.COVID19_CASES + '</b>';
    document.getElementById("infoCovid19Deaths").innerHTML = '<b>' + props.COVID19_DEATHS + '</b>';
};

// Initialize JSON datatable
const buildDataTable = (data) => {
  const table = $('#datatable1').DataTable({
    "data": data.features,
    "columns": [
      {
        "data": "properties.NAME"
      },
      {
        "data": "properties.POPULATION"
      },
      {
        "data": "properties.POP_DENSITY"
      },
      {
        "data": "properties.COVID19_CASES"
      },
      {
        "data": "properties.COVID19_DEATHS"
      },
    ]
});
    
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

//Assign map color to county depending on number of covid-cases
function getColor(covidCases) {
    // Returns a color depending on the population density value.
    // This value is then used to select a color from a list of colors.
    return covidCases > 200000 ? '#800026' :
        covidCases > 100000 ? '#BD0026' :
        covidCases > 75000 ? '#E31A1C' :
        covidCases > 55000 ? '#FC4E2A' :
        covidCases > 250000 ? '#FD8D3C' :
        covidCases > 15000 ? '#FEB24C' :
        covidCases > 0 ? '#FED976' :
        '#FFEDA0';
}


// Style layers 
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
    }
    const layer = map._layers[layerId];
    layer.fire('click');
    lastClickedLayer = layer;
}

// Setup Custom Controls
buildSelect();
//buildLegend();

//Setup listener events 
$('#select-box1').change(function() {
    layerSelect(this.value);
});
