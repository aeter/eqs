var EQS = {};

EQS.main = function() {
    var DAMAGE_DESCRIPTIONS = {
        "0": "UNKNOWN",
        "1": "LIMITED (<1m USD)",
        "2": "MODERATE (1-5m USD)",
        "3": "SEVERE (5-524m USD)",
        "4": "EXTREME (>525m USD)"
    }

    class DB {
        static init() {
            alasql.promise(
                ["CREATE TABLE IF NOT EXISTS quakes",
                 "SELECT * INTO quakes from TSV('data/significant_quakes.tsv')",
                ]).then(function(data) { 
                    // for cleaner js code (sliders use 0, not NULL), we update the DB -
                    // we insert '0's where there's NULL for some DB columns.
                    alasql("UPDATE quakes SET DAMAGE_DESCRIPTION = 0 WHERE DAMAGE_DESCRIPTION = ''") 
                    alasql("UPDATE quakes SET DEATHS = 0 WHERE DEATHS = ''") 
                    alasql("UPDATE quakes SET TOTAL_DEATHS = 0 WHERE TOTAL_DEATHS = ''") 
                });
        }
    }
    DB.init();

    var maparea = $(".mapcontainer");
    maparea.mapael({
        map: {
            name: "world_countries",
            zoom: {
                enabled: true,
                maxLevel: 50
            },
            defaultPlot: {
                eventHandlers: {
                    click: function (e, id, mapElem, textElem, elemOptions) {
                        var clicked_on_plot = typeof elemOptions.I_D != 'undefined';
                        if (clicked_on_plot) {
                            var res = alasql('select * from quakes where I_D = ' + elemOptions.I_D)[0];
                            var html = "<ul>";
                            Object.keys(res).forEach(function(key) {
                                if (res[key] != '') {
                                    html += "<li>" + key + ": " + res[key] + "</li>";
                                }
                            });
                            html += "</ul>"
                            $('#quake_info').html(html);
                        }
                    }
                }
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
    noUiSlider.create($('#year_slider').get(0), {
        start: [-10, 9],
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

    noUiSlider.create($('#damage_slider').get(0), {
        start: [0, 4],
        step: 1,
        connect: true,
        range: {
            min: 0,
            max: 4,
        },
        pips: {
            mode: 'steps',
            format: {to: function(value, type) { return DAMAGE_DESCRIPTIONS[value]; } }
        }
    });

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

    damage_slider.noUiSlider.on('end', recalculate_quakes);
    year_slider.noUiSlider.on('end', recalculate_quakes);
    deaths_info_slider.noUiSlider.on('end', recalculate_quakes);

    class QuakeToolTip {
        static damage_description(quake) {
            if (quake['DAMAGE_DESCRIPTION'] == "4")
                return '<span style="color:red;">Damage: ' + DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']] + '</span>';
            else
                return 'Damage: ' + DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']];
        }

        static date(quake) {
            if (quake['YEAR'] != "" && quake['MONTH'] != '' && quake["DAY"] != '')
                return "Date: " + quake['YEAR'] + "-" + quake["MONTH"] + "-" + quake["DAY"];
            else
                return "Date: " + quake['YEAR'];
        }

        static deaths(quake) {
            if (parseInt(quake['TOTAL_DEATHS']) > parseInt(quake['DEATHS']))
                var deaths = parseInt(quake['TOTAL_DEATHS']);
            else
                var deaths = parseInt(quake['DEATHS']);
            
            if (deaths > 10000)  {
                return '<span style="color:red;">Deaths: ' + deaths + '</span>';
            } else {
                deaths = deaths == 0 ? "-" : deaths; 
                return 'Deaths: ' + deaths;
            }
        }

        static html(quake) {
            return QuakeToolTip.date(quake)
                + "<br>" 
                + "Location: " + quake['LOCATION_NAME']
                + "<br>"
                + QuakeToolTip.damage_description(quake)
                + "<br>"
                + QuakeToolTip.deaths(quake);
        }
    }

    // workaround for https://github.com/neveldo/jQuery-Mapael/issues/253
    // shrinks the bubbles when zooming the map in, expands them on zoom-out.
    var zoom_size = 5;
    class BubblesZoom {
        static zoom() {
            var zoom_level = maparea.data("mapael").zoomData.zoomLevel;
            var new_zoom_size = zoom_level <= 10 ? 5 : 1;
            if (new_zoom_size != zoom_size) {
                zoom_size = new_zoom_size;
                recalculate_quakes();
            }
        }
    }
    maparea.on("zoom.mapael", BubblesZoom.zoom);

    function recalculate_quakes() {
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
          quakes[i]['tooltip'] = {content: QuakeToolTip.html(quakes[i])};
          quakes[i]['size'] = zoom_size;
          if (quakes[i]['DAMAGE_DESCRIPTION'] == "4" 
                  || parseInt(quakes[i]['TOTAL_DEATHS']) > 10000
                  || parseInt(quakes[i]['DEATHS']) > 1000) {
              quakes[i]['attrs'] = { fill: 'red' };
          }
          new_plots[quakes[i]['I_D']] = quakes[i];
        }

        $(".mapcontainer").trigger('update', [{
            mapOptions: {'areas': {}, 'plots': {}}, 
            newPlots: new_plots,
            deletePlotKeys: Object.keys(maparea.data('mapael').plots),
            animDuration: 0 
        }]);
    };
}
