var EQS = {};

EQS.DAMAGE_DESCRIPTIONS = {
    "0": "UNKNOWN",
    "1": "LIMITED (<1m USD)",
    "2": "MODERATE (1-5m USD)",
    "3": "SEVERE (5-524m USD)",
    "4": "EXTREME (>525m USD)"
};

EQS.ZOOM_SIZE = 5;

EQS.main = function() {
    EQS.init_db();
    EQS.init_world_map();
    EQS.create_year_slider();
    EQS.create_damage_slider();
    EQS.create_deaths_info_slider();
    EQS.setup_world_map_zoom();
}

// workaround for https://github.com/neveldo/jQuery-Mapael/issues/253
// shrinks the bubbles when zooming the map in, expands them on zoom-out.
EQS.setup_world_map_zoom = function() {
    function zoom() {
        var zoom_level = $(".mapcontainer").data("mapael").zoomData.zoomLevel;
        var new_zoom_size = zoom_level <= 10 ? 5 : 1;
        if (new_zoom_size != EQS.ZOOM_SIZE) {
            EQS.ZOOM_SIZE = new_zoom_size;
            EQS.recalculate_quakes();
        }
    }
    $(".mapcontainer").on("zoom.mapael", zoom);
}

EQS.init_db = function() {
    alasql.promise(
        ["CREATE TABLE IF NOT EXISTS quakes",
         "SELECT * INTO quakes from TSV('data/significant_quakes.tsv')",
        ]).then(function(data) { 
            // for cleaner js code (sliders use 0, not NULL), we update the DB -
            // we insert '0's where there's NULL for some DB columns.
            alasql("UPDATE quakes SET DAMAGE_DESCRIPTION = 0 WHERE DAMAGE_DESCRIPTION = ''") 
            alasql("UPDATE quakes SET DEATHS = 0 WHERE DEATHS = ''") 
            alasql("UPDATE quakes SET TOTAL_DEATHS = 0 WHERE TOTAL_DEATHS = ''") 

            // now, after the database loads for the first time, show some quakes
            // on the screen (per the sliders filtering).
            EQS.recalculate_quakes();
        });
};

EQS.init_world_map = function() {
    var maparea = $(".mapcontainer");
    maparea.mapael({
        map: {
            name: "world_countries",
            zoom: {
                enabled: true,
                maxLevel: 50
            },
            defaultArea: {
                tooltip: {
                    content: function(e) { return $(e.node).attr("data-id"); }
                },
                eventHandlers: {
                    click: function (e, id, mapElem, textElem, elemOptions) {
                        maparea.trigger('zoom', {
                            area: id,
                            areaMargin: 10
                        });
                    }
                }
            }
        }
    });
};

EQS.create_year_slider = function() {
    noUiSlider.create($('#year_slider').get(0), {
        start: [1900, 2018],
        step: 1,
        connect: true,
        tooltips: true,
        range: {
            'min': -2150,
            '50%': [1860, 1],
            'max': 2018
        },
        pips: {
            mode: 'values',
            values: [-2150, -1500, -1000, -500, 0, 500, 
                     1000, 1500, 1850, 1880, 1900, 1920, 1940,
                     1960, 1980, 2000, 2018],
            density: 1000
        }
    });
    year_slider.noUiSlider.on('change', EQS.recalculate_quakes);
}

EQS.create_damage_slider = function() {
    noUiSlider.create($('#damage_slider').get(0), {
        start: [3, 4],
        step: 1,
        connect: true,
        range: {
            min: 0,
            max: 4,
        },
        pips: {
            mode: 'steps',
            format: {to: function(value, type) { return EQS.DAMAGE_DESCRIPTIONS[value]; } }
        }
    });
    damage_slider.noUiSlider.on('change', EQS.recalculate_quakes);
}

EQS.create_deaths_info_slider = function() {
    noUiSlider.create($('#deaths_info_slider').get(0), {
        start: [0, 830000],
        step: 1,
        connect: true,
        tooltips: true,
        range: {
            min: 0,
            '10%': [10, 1],
            '30%': [3000, 1], 
            '70%': [10000, 1], 
            max: 830000
        },
        pips: {
            mode: 'values',
            values: [0, 10, 3000, 10000, 830000],
            density: 1000
        }
    });
    deaths_info_slider.noUiSlider.on('change', EQS.recalculate_quakes);
}

EQS.make_html_tooltip = function(quake) {
    function magnitude(quake) {
        if (quake['EQ_PRIMARY'] != '') 
            return 'Magnitude: ' + quake['EQ_PRIMARY'] + '<br>';
        else
            return '';
    }

    function damage_description(quake) {
        if (quake['DAMAGE_DESCRIPTION'] == "4")
            return '<span style="color:red;">Damage: ' + EQS.DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']] + '</span><br>';
        else
            return 'Damage: ' + EQS.DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']] + '<br>';
    }

    function date(quake) {
        if (quake['YEAR'] != "" && quake['MONTH'] != '' && quake["DAY"] != '')
            return "Date: " + quake['YEAR'] + "-" + quake["MONTH"] + "-" + quake["DAY"] + '<br>';
        else
            return "Date: " + quake['YEAR'] + '<br>';
    }

    function deaths(quake) {
        var deaths = quake['TOTAL_DEATHS'] == '0' ? parseInt(quake['DEATHS']) : parseInt(quake['TOTAL_DEATHS']);
        
        if (deaths > 10000)  {
            return '<span style="color:red;">Total deaths: ' + deaths + '</span>';
        } else {
            deaths = deaths == 0 ? "-" : deaths; 
            return 'Total deaths: ' + deaths;
        }
    }

    function mmi_intensity(quake) {
        return quake['INTENSITY'] == '' ? '' : 'Modified Mercalii Intensity: ' + quake['INTENSITY'] + "<br>";
    }

    function tsunami(quake) {
        return quake['FLAG_TSUNAMI'] == '' ? '' : 'Caused tsunami: yes<br>';
    }

    function focal_depth(quake) {
        return quake['FOCAL_DEPTH'] == '' ? '' : 'Focal depth: ' + quake['FOCAL_DEPTH'] + ' km.<br>';
    }

    function injuries(quake) {
        if (quake['TOTAL_INJURIES'] != '')
            var injuries = parseInt(quake['TOTAL_INJURIES']);
        else if (quake['INJURIES'] != '')
            var injuries = parseInt(quake['INJURIES']);
        else
            var injuries = '';

        return injuries == '' ? '' : 'Total injuries: ' + injuries + '<br>';
    }

    function houses_destroyed(quake) {
        if (quake['TOTAL_HOUSES_DESTROYED'] != '')
            var houses_destroyed = parseInt(quake['TOTAL_HOUSES_DESTROYED']);
        else if (quake['HOUSES_DESTROYED'] != '')
            var houses_destroyed = parseInt(quake['HOUSES_DESTROYED']);
        else
            var houses_destroyed = '';

        return houses_destroyed == '' ? '' : 'Total houses destroyed: ' + houses_destroyed + '<br>';
    }

    function html(quake) {
        return date(quake)
            + "Location: " + quake['LOCATION_NAME'] + '<br>'
            + magnitude(quake)
            + damage_description(quake)
            + mmi_intensity(quake)
            + focal_depth(quake)
            + tsunami(quake)
            + houses_destroyed(quake)
            + injuries(quake)
            + deaths(quake);
    }

    return html(quake);
}

EQS.recalculate_quakes = function() {
    var years = year_slider.noUiSlider.get();
    var damage_descriptions = damage_slider.noUiSlider.get();
    var deaths = deaths_info_slider.noUiSlider.get();

    var query = 'select * from quakes where' 
                + ' YEAR >= __start_year__ and YEAR <= __end_year__ '
                + ' AND DAMAGE_DESCRIPTION >= __damage_min__ AND DAMAGE_DESCRIPTION <= __damage_max__ '
                + ' AND ((TOTAL_DEATHS >= __deaths_min__ AND TOTAL_DEATHS <= __deaths_max__) '
                + '   OR (DEATHS >= __deaths_min__  AND DEATHS <= __deaths_max__)) ';

    var quakes = alasql(query
                .replace('__start_year__', years[0])
                .replace('__end_year__', years[1])
                .replace('__damage_min__', damage_descriptions[0])
                .replace('__damage_max__', damage_descriptions[1])
                .replace('__deaths_min__', deaths[0])
                .replace('__deaths_max__', deaths[1]));

    var new_plots = {};
    for (i = 0; i < quakes.length; i++) {
      quakes[i]['latitude'] = quakes[i]['LATITUDE'];
      quakes[i]['longitude'] = quakes[i]['LONGITUDE'];
      quakes[i]['tooltip'] = {content: EQS.make_html_tooltip(quakes[i])};
      quakes[i]['size'] = EQS.ZOOM_SIZE;
      if (quakes[i]['DAMAGE_DESCRIPTION'] == "4" 
              || parseInt(quakes[i]['TOTAL_DEATHS']) > 10000
              || parseInt(quakes[i]['DEATHS']) > 10000) {
          quakes[i]['attrs'] = { fill: 'red' };
      }
      new_plots[quakes[i]['I_D']] = quakes[i];
    }

    $(".mapcontainer").trigger('update', [{
        mapOptions: {'areas': {}, 'plots': {}}, 
        newPlots: new_plots,
        deletePlotKeys: Object.keys($(".mapcontainer").data('mapael').plots),
        animDuration: 0 
    }]);

    $('#title_button').html(
        "destructive earthquakes <br><small>year: __start_year__-__end_year__</small>"
            .replace('__start_year__', parseInt(years[0]))
            .replace('__end_year__', parseInt(years[1])));
}

